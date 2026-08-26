import {
    CLUB,
    EXCLUDED,
    GOOGLE_SHEETS_CSV_URL,
    INCLUDED,
    ORGANIZER_EMAIL,
    TIMEZONE,
} from "./config";
import {
    type CalendarioData,
    formatDateLabel,
    formatMonthLabel,
    intToDate,
    lowerBound,
    type NoteCategory,
    type NoteInfo,
    normalizeKey,
    type Participation,
    PREPARED_SPEECH_LABEL,
    ROLE_LABELS,
    SPEECH_START,
    todayInt,
} from "./core";
import { generateIcs, toGoogleCalendarUrl } from "./ics";
import { parseCsvToData } from "./parser";

let DATA: CalendarioData | null = null;
let lastRendered: { person: string; parts: Participation[] } | null = null;
const SESSION_TIME = "20:00–22:00";

const els = {
    persona: document.getElementById("persona") as HTMLSelectElement,
    descargar: document.getElementById("descargar") as HTMLButtonElement,
    actualizar: document.getElementById("actualizar") as HTMLButtonElement,
    resultados: document.getElementById("resultados") as HTMLElement,
    destinatarioField: document.getElementById("destinatario-field") as HTMLElement,
    destinatario: document.getElementById("destinatario") as HTMLInputElement,
    destinatarioError: document.getElementById("destinatario-error") as HTMLElement,
    proxima: document.getElementById("proxima") as HTMLElement,
    proximaRol: document.getElementById("proxima-rol") as HTMLElement,
    proximaFecha: document.getElementById("proxima-fecha") as HTMLElement,
    meses: document.getElementById("meses") as HTMLElement,
    status: document.getElementById("status") as HTMLElement,
    lastUpdate: document.getElementById("last-update") as HTMLElement,
};

function status(message: string, kind: "info" | "error" | "ok" = "info"): void {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.dataset.kind = kind;
    els.status.setAttribute("role", kind === "error" ? "alert" : "status");
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function updateRecipientState(showError = false): void {
    const value = els.destinatario.value.trim();
    const valid = isValidEmail(value);
    const hasPerson = Boolean(DATA && els.persona.value);
    const invalid = showError && value.length > 0 && !valid;

    els.destinatario.disabled = !DATA || !hasPerson;
    els.destinatario.setAttribute("aria-invalid", String(invalid));
    els.destinatarioError.hidden = !invalid;
    els.destinatarioError.textContent = invalid
        ? "Escribe un correo válido para generar la invitación."
        : "";
    els.descargar.disabled = !hasPerson || !valid;
}

function applyFilters(raw: CalendarioData): CalendarioData {
    const today = todayInt(TIMEZONE);
    const excludedKeys = new Set(EXCLUDED.map(normalizeKey));
    const includedKeys = new Set(INCLUDED.map(normalizeKey));
    const keep = new Map<string, Participation[]>();

    for (const person of raw.persons) {
        const key = normalizeKey(person);
        const all = raw.index[key] ?? [];

        // Solo fechas >= hoy
        const start = lowerBound(all, today);
        const future = all.slice(start);
        if (future.length === 0) continue;
        if (excludedKeys.has(key) && !includedKeys.has(key)) continue;
        keep.set(person, future);
    }

    const persons = Array.from(keep.keys()).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" })
    );

    const index: Record<string, Participation[]> = {};
    for (const p of persons) index[normalizeKey(p)] = keep.get(p)!;

    return { v: 1, roles: ROLE_LABELS, persons, index, notes: raw.notes };
}

async function loadData(source: "snapshot" | "remote" = "snapshot"): Promise<void> {
    const previous = els.persona.value;
    const previousData = DATA;
    lastRendered = null;
    els.resultados.hidden = true;
    els.descargar.disabled = true;
    els.destinatario.disabled = true;
    status(source === "remote" ? "Actualizando desde Google Sheets…" : "Cargando calendario…");
    els.actualizar.disabled = true;
    els.persona.disabled = true;

    try {
        const res = await fetch(source === "remote" ? GOOGLE_SHEETS_CSV_URL : "./calendario.json", {
            cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        status("Procesando participaciones…");
        const raw =
            source === "remote"
                ? parseCsvToData(await res.text())
                : ((await res.json()) as CalendarioData);
        DATA = applyFilters(raw);

        populatePersonas();
        updateTimestamp();
        if (DATA.persons.length === 0) {
            status("No hay participaciones próximas disponibles.");
        } else if (previous && DATA.persons.includes(previous)) {
            els.persona.value = previous;
            show(false);
        } else {
            status(
                source === "remote"
                    ? "Calendario actualizado desde Google Sheets. Selecciona tu nombre."
                    : "Calendario listo. Selecciona tu nombre.",
                "ok"
            );
        }
    } catch (err) {
        console.error(err);
        if (source === "remote" && previousData) {
            DATA = previousData;
            populatePersonas();
            if (previous && DATA.persons.includes(previous)) {
                els.persona.value = previous;
                show(false);
            }
            status(
                "No se pudo actualizar. Se conservan los datos anteriores; inténtalo de nuevo.",
                "error"
            );
        } else {
            DATA = null;
            lastRendered = null;
            els.resultados.hidden = true;
            els.descargar.disabled = true;
            els.destinatarioField.hidden = true;
            els.destinatario.value = "";
            els.persona.replaceChildren();
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "No se pudo cargar el calendario";
            els.persona.append(option);
            status(
                "No se pudo cargar el calendario. Revisa tu conexión e inténtalo de nuevo.",
                "error"
            );
        }
    } finally {
        els.actualizar.disabled = false;
        els.persona.disabled = !DATA || DATA.persons.length === 0;
        updateRecipientState(false);
    }
}

function updateTimestamp(): void {
    if (!els.lastUpdate) return;
    const now = new Date();
    const parts = new Intl.DateTimeFormat("es-MX", {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(now);
    els.lastUpdate.textContent = `Última consulta: ${parts}`;
}

function populatePersonas(): void {
    if (!DATA) return;
    const previous = els.persona.value;
    els.persona.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = DATA.persons.length
        ? "Selecciona tu nombre…"
        : "No hay próximas participaciones";
    els.persona.append(placeholder);
    for (const p of DATA.persons) {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        els.persona.append(opt);
    }
    if (previous && DATA.persons.includes(previous)) {
        els.persona.value = previous;
    }
}

function groupForRender(parts: Participation[], notes: Record<number, NoteInfo>) {
    const byDate = new Map<number, Participation[]>();
    for (const p of parts) {
        const list = byDate.get(p[0]) ?? [];
        list.push(p);
        byDate.set(p[0], list);
    }

    const rows: Array<{ dateInt: number; speeches: string[]; roles: string[]; note?: NoteInfo }> =
        [];
    for (const [dateInt, list] of byDate) {
        const speeches: string[] = [];
        const roles: string[] = [];
        for (const [, roleId] of list) {
            const label = ROLE_LABELS[roleId] ?? `Rol ${roleId}`;
            if (roleId >= SPEECH_START) {
                if (!speeches.includes(PREPARED_SPEECH_LABEL)) {
                    speeches.push(PREPARED_SPEECH_LABEL);
                }
            } else roles.push(label);
        }
        rows.push({ dateInt, speeches, roles, note: notes[dateInt] });
    }
    rows.sort((a, b) => a.dateInt - b.dateInt);
    return rows;
}

function appendRow(
    ul: HTMLUListElement,
    dateLabel: string,
    items: string[],
    variant: "speech" | "role",
    noteCategory?: NoteCategory,
    googleUrl?: string
): void {
    const li = document.createElement("li");
    li.className = variant === "speech" ? "item speech" : "item role";
    if (noteCategory) {
        li.classList.add(`note-${noteCategory}`);
    }
    const text = document.createElement("span");
    text.className = "text";
    text.textContent = items.join(" · ");
    const date = document.createElement("span");
    date.className = "date";
    date.textContent = dateLabel;
    li.append(text, date);
    if (googleUrl) {
        const link = document.createElement("a");
        link.className = "icon-btn";
        link.href = googleUrl;
        link.target = "_blank";
        link.rel = "noopener";
        link.setAttribute("data-tooltip", "Agregar al calendario");
        link.setAttribute("aria-label", `Agregar al calendario - ${dateLabel}`);
        // Lucide calendar-plus (currentColor = loyal-blue #004165)
        link.innerHTML =
            '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h8"/><path d="M12 18v-4"/><path d="M12 14h.01"/></svg>';
        li.append(link);
    }
    ul.append(li);
}

function eventDateLabel(dateInt: number): string {
    return `${formatDateLabel(intToDate(dateInt))} · ${SESSION_TIME} · hora de Guadalajara`;
}

function render(rows: ReturnType<typeof groupForRender>): {
    discursos: number;
    roles: number;
} {
    els.meses.replaceChildren();

    let d = 0;
    let r = 0;
    const months = new Map<
        string,
        {
            label: string;
            rows: ReturnType<typeof groupForRender>;
            discursos: number;
            roles: number;
            notes: NoteInfo[];
        }
    >();

    for (const row of rows) {
        const date = intToDate(row.dateInt);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        const month = months.get(monthKey) ?? {
            label: formatMonthLabel(date),
            rows: [],
            discursos: 0,
            roles: 0,
            notes: [],
        };
        month.rows.push(row);
        month.discursos += row.speeches.length;
        month.roles += row.roles.length;
        if (row.note && !month.notes.some((n) => n.text === row.note!.text)) {
            month.notes.push(row.note);
        }
        months.set(monthKey, month);
        d += row.speeches.length;
        r += row.roles.length;
    }

    for (const month of months.values()) {
        const section = document.createElement("section");
        section.className = "month";

        const heading = document.createElement("h3");
        heading.className = "month-heading";
        const title = document.createElement("span");
        title.className = "month-title";
        title.textContent = month.label;

        const summary = document.createElement("span");
        summary.className = "month-summary";
        const speeches = document.createElement("span");
        speeches.className = "badge badge--speech";
        speeches.textContent = `${month.discursos} ${month.discursos === 1 ? "discurso" : "discursos"}`;
        const roles = document.createElement("span");
        roles.className = "badge badge--role";
        roles.textContent = `${month.roles} ${month.roles === 1 ? "rol" : "roles"}`;
        summary.append(speeches, roles);

        for (const note of month.notes) {
            const badge = document.createElement("span");
            badge.className = `badge badge--note ${note.category}`;
            badge.textContent = note.text;
            summary.append(badge);
        }

        heading.append(title, summary);

        const list = document.createElement("ul");
        list.className = "participaciones";
        for (const row of month.rows) {
            const items = [...row.speeches, ...row.roles];
            const summary =
                row.speeches.length > 0 ? items.join(", ") : `Mesa de Trabajo: ${items.join(", ")}`;
            let description = items.join(", ");
            if (row.note) description += `\n\nNota: ${row.note.text}`;
            const googleUrl = toGoogleCalendarUrl(row.dateInt, summary, description);
            appendRow(
                list,
                eventDateLabel(row.dateInt),
                items,
                row.speeches.length > 0 ? "speech" : "role",
                row.note?.category,
                googleUrl
            );
        }

        section.append(heading, list);
        els.meses.append(section);
    }

    if (months.size === 0) {
        const empty = document.createElement("p");
        empty.className = "no-results";
        empty.textContent = "Sin participaciones próximas";
        els.meses.append(empty);
    }

    if (rows.length > 0) {
        const next = rows[0];
        const nextItems = [...next.speeches, ...next.roles];
        els.proximaRol.textContent = nextItems.join(" · ");
        els.proximaFecha.textContent = eventDateLabel(next.dateInt);
        els.proxima.hidden = false;
    } else {
        els.proxima.hidden = true;
    }

    return { discursos: d, roles: r };
}

function show(shouldFocus = true): void {
    if (!DATA) {
        status("Cargando calendario…", "info");
        return;
    }
    const person = els.persona.value;
    if (!person) {
        status("Selecciona un nombre para ver tus participaciones.");
        els.resultados.hidden = true;
        els.destinatarioField.hidden = true;
        els.destinatario.value = "";
        lastRendered = null;
        updateRecipientState(false);
        return;
    }

    els.destinatarioField.hidden = false;
    updateRecipientState(false);

    const key = normalizeKey(person);
    const parts = DATA.index[key] ?? [];
    const rows = groupForRender(parts, DATA.notes);
    const totals = render(rows);

    els.resultados.hidden = false;
    els.descargar.disabled = totals.discursos + totals.roles === 0;
    lastRendered = { person, parts };

    if (totals.discursos + totals.roles === 0) {
        status("No hay participaciones para esta persona.", "info");
    } else {
        status(`${person}: ${totals.discursos + totals.roles} participaciones próximas.`, "ok");
    }

    if (shouldFocus) els.destinatario.focus({ preventScroll: false });
}

function downloadIcs(): void {
    if (!lastRendered || !DATA) return;
    const { person, parts } = lastRendered;
    const attendeeEmail = els.destinatario.value.trim();
    if (!isValidEmail(attendeeEmail)) {
        updateRecipientState(true);
        els.destinatario.focus({ preventScroll: false });
        return;
    }

    const ics = generateIcs(
        person,
        parts,
        {
            organizerEmail: ORGANIZER_EMAIL,
            attendeeEmail,
            attendeeName: person,
        },
        DATA.notes
    );
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invitacion-${slug(person)}.ics`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status(`Invitación generada para ${person}.`, "ok");
}

function slug(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function bind(): void {
    els.persona.addEventListener("change", () => {
        els.destinatario.value = "";
        show();
    });
    els.destinatario.addEventListener("input", () => updateRecipientState(true));
    els.descargar.addEventListener("click", downloadIcs);
    els.actualizar.addEventListener("click", () => loadData("remote"));

    const year = new Date().getFullYear();
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = String(year);

    document.documentElement.dataset.club = CLUB;
}

bind();
loadData("snapshot");
