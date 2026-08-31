import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
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
    actualizar: document.getElementById("actualizar") as HTMLButtonElement,
    descargarPdf: document.getElementById("descargar-pdf") as HTMLButtonElement,
    resultados: document.getElementById("resultados") as HTMLElement,
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
    if (els.descargarPdf) {
        els.descargarPdf.hidden = true;
        els.descargarPdf.disabled = true;
    }
    status(source === "remote" ? "Actualizando desde Google Sheets…" : "Cargando calendario…");
    els.actualizar.disabled = true;
    els.persona.disabled = true;
    // v2 skeleton (redesign: avoid generic spinner, match card shape)
    if (source === "remote") {
        els.meses.replaceChildren();
        for (let i = 0; i < 2; i++) {
            const sk = document.createElement("div");
            sk.className = "skeleton";
            sk.setAttribute("aria-hidden", "true");
            els.meses.append(sk);
        }
        els.resultados.hidden = false;
        els.meses.setAttribute("aria-busy", "true");
    }

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
                    ? "Calendario actualizado desde Google Sheets. Elige tu nombre para ver tus participaciones."
                    : "Calendario listo. Elige tu nombre para ver tus participaciones.",
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
            if (els.descargarPdf) {
                els.descargarPdf.hidden = true;
                els.descargarPdf.disabled = true;
            }
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
        els.meses.removeAttribute("aria-busy");
        if (source === "remote" && !DATA) {
            // clear skeleton if remote failed without data
            els.meses.replaceChildren();
        }
        els.actualizar.disabled = false;
        els.persona.disabled = !DATA || DATA.persons.length === 0;
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
        // Phosphor calendar-plus (v2: replaces Lucide, single family)
        link.innerHTML =
            '<i class="ph ph-calendar-plus" aria-hidden="true" style="font-size:18px"></i>';
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
        if (row.note && !month.notes.some((n) => n.text === row.note?.text)) {
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
            // Google template usa default 30 min; aclarar recordatorio 14d/7d del ics
            const reminder =
                row.speeches.length > 0 && row.roles.length > 0
                    ? "Recordatorio: 14 días discursos / 7 días roles (ajusta notificación en Google Calendar)"
                    : row.speeches.length > 0
                      ? "Recordatorio: 14 días antes (ajusta notificación en Google Calendar)"
                      : "Recordatorio: 7 días antes (ajusta notificación en Google Calendar)";
            description += `\n\n${reminder}`;
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
        const empty = document.createElement("div");
        empty.className = "no-results";
        empty.innerHTML =
            '<i class="ph ph-calendar-blank" aria-hidden="true" style="font-size:24px; display:block; margin-bottom:8px;"></i><p style="margin:0">Sin participaciones próximas</p><p style="margin:4px 0 0; font-size:0.88rem; color:var(--ink-soft)">Selecciona otro nombre o actualiza el calendario.</p>';
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
        status("Elige tu nombre para ver tus participaciones.");
        els.resultados.hidden = true;
        if (els.descargarPdf) {
            els.descargarPdf.hidden = true;
            els.descargarPdf.disabled = true;
        }
        lastRendered = null;
        return;
    }

    const key = normalizeKey(person);
    const parts = DATA.index[key] ?? [];
    const rows = groupForRender(parts, DATA.notes);
    const totals = render(rows);

    els.resultados.hidden = false;
    lastRendered = { person, parts };

    const hasResults = totals.discursos + totals.roles > 0;
    if (els.descargarPdf) {
        els.descargarPdf.hidden = !hasResults;
        els.descargarPdf.disabled = !hasResults;
    }

    if (!hasResults) {
        status("No hay participaciones para esta persona.", "info");
    } else {
        status(`${person}: ${totals.discursos + totals.roles} participaciones próximas.`, "ok");
    }

    if (shouldFocus && hasResults) els.descargarPdf?.focus({ preventScroll: false });
}

// ICS oculto: se mantiene por compatibilidad pero sin UI (pedido: deja oculto el ICS)
function _hiddenDownloadIcs(
    person: string,
    parts: Participation[],
    attendeeEmail: string,
    attendeeName: string
): void {
    if (!DATA) return;
    const ics = generateIcs(
        person,
        parts,
        {
            organizerEmail: ORGANIZER_EMAIL,
            attendeeEmail,
            attendeeName,
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
}
// Exponer para uso manual desde consola si se necesita
// @ts-expect-error
(window as unknown as Record<string, unknown>)._hiddenDownloadIcs = _hiddenDownloadIcs;

async function downloadPdf(): Promise<void> {
    if (!lastRendered || !DATA) return;
    const { person } = lastRendered;
    const target = document.getElementById("resultados") as HTMLElement | null;
    if (!target) return;
    status("Generando PDF…", "info");
    els.descargarPdf.disabled = true;
    const wasDark = document.documentElement.classList.contains("dark");
    try {
        // Fix universal transparencia: desactivar dark en <html> + matar animaciones + flatten alpha
        if (wasDark) document.documentElement.classList.remove("dark");
        // Clonar para capturar sin hidden y con fondo blanco (header reducido 8px + h2 compacto)
        const clone = target.cloneNode(true) as HTMLElement;
        clone.hidden = false;
        clone.style.position = "fixed";
        clone.style.left = "-10000px";
        clone.style.top = "0";
        clone.style.width = `${target.offsetWidth || 700}px`;
        clone.style.background = "#ffffff";
        clone.style.backgroundColor = "#ffffff";
        clone.style.padding = "8px 16px 16px";
        clone.style.animation = "none";
        clone.style.opacity = "1";
        clone.querySelectorAll("*").forEach((el) => {
            const h = el as HTMLElement;
            h.style.animation = "none";
            h.style.transition = "none";
            if (h.style.opacity === "" || h.style.opacity === "0") h.style.opacity = "1";
        });
        // Compactar header clonado para quitar espacio principal
        const h2 = clone.querySelector("#resultados-titulo") as HTMLElement | null;
        if (h2) h2.style.marginBottom = "0.35rem";
        const proximaEl = clone.querySelector("#proxima") as HTMLElement | null;
        if (proximaEl) proximaEl.style.marginTop = "0.75rem";
        document.body.appendChild(clone);
        // Doble rAF para asegurar frame pintado sin opacity 0 (H2)
        await new Promise<void>((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => r()))
        );

        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 20; // 10mm margen cada lado
        const margin = 10;
        const headerH = 18; // reducido de 22

        // Header PDF compacto (solo reducir, no quitar)
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(0, 65, 101);
        pdf.text(`Toastmasters Guadalajara — ${person}`, 10, 10);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(90, 90, 90);
        const dateStr = new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date());
        pdf.text(`Generado: ${dateStr} · 20:00–22:00 hora de Guadalajara`, 10, 15);

        // Paginación por bloques con espacio normal entre cards (no corte mid-card)
        const toMm = (px: number) => (px * imgWidth) / clone.offsetWidth;
        const availFirst = pageHeight - headerH - margin;
        const availOther = pageHeight - margin * 2;
        let used = 0;
        let isFirst = true;
        const blocks: HTMLElement[] = [
            clone.querySelector("#resultados-titulo") as HTMLElement,
            clone.querySelector("#proxima") as HTMLElement,
            ...Array.from(clone.querySelectorAll("section.month") as NodeListOf<HTMLElement>),
        ].filter((el) => el && !el.hidden && el.offsetHeight > 0) as HTMLElement[];

        // Fallback fino: si un month es más alto que página, dividir por li.item
        const expandedBlocks: HTMLElement[] = [];
        for (const b of blocks) {
            const hMm = toMm(b.offsetHeight + 8);
            const avail = isFirst ? availFirst : availOther;
            // Si es month y no cabe entero, expandir a sus li (mantiene espacio normal 0.5rem)
            if (
                b.tagName.toLowerCase() === "section" &&
                hMm > avail &&
                b.querySelectorAll("li.item").length > 0
            ) {
                // medir heading aparte
                const heading = b.querySelector(".month-heading") as HTMLElement | null;
                if (heading) expandedBlocks.push(heading);
                for (const li of b.querySelectorAll("li.item")) {
                    expandedBlocks.push(li as HTMLElement);
                }
            } else {
                expandedBlocks.push(b);
            }
        }

        // Fondo blanco base primera página
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");

        for (const block of expandedBlocks) {
            const isHeading = block.classList.contains("month-heading");
            const gap = isHeading ? 4 : 8; // espacio normal entre cards (0.5rem ≈ 8px)
            const blockH = block.offsetHeight;
            const blockHmm = toMm(blockH + gap);
            const avail = isFirst ? availFirst - used : availOther - used;
            if (blockHmm > avail) {
                pdf.addPage();
                pdf.setFillColor(255, 255, 255);
                pdf.rect(0, 0, pageWidth, pageHeight, "F");
                used = 0;
                isFirst = false;
            }
            const c = await html2canvas(block, {
                scale: 2,
                backgroundColor: "#ffffff",
                useCORS: true,
                logging: false,
            });
            const y = (isFirst ? headerH : margin) + used;
            const imgH = (c.height * imgWidth) / c.width;
            pdf.addImage(c.toDataURL("image/jpeg", 1.0), "JPEG", 10, y, imgWidth, imgH);
            used += blockHmm;
        }

        document.body.removeChild(clone);

        pdf.save(`participaciones-${slug(person)}.pdf`);
        status(`PDF generado para ${person}.`, "ok");
    } catch (err) {
        console.error(err);
        status("No se pudo generar el PDF. Inténtalo de nuevo.", "error");
    } finally {
        if (wasDark) document.documentElement.classList.add("dark");
        if (lastRendered) els.descargarPdf.disabled = false;
    }
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
        show();
    });
    els.descargarPdf?.addEventListener("click", downloadPdf);
    els.actualizar.addEventListener("click", () => loadData("remote"));

    // Dark/Light toggle con Phosphor sun/moon (v2: single family)
    const toggle = document.getElementById("theme-toggle") as HTMLButtonElement | null;
    const applyTheme = (dark: boolean) => {
        document.documentElement.classList.toggle("dark", dark);
        localStorage.setItem("theme", dark ? "dark" : "light");
        if (toggle) {
            toggle.setAttribute("aria-pressed", String(dark));
            toggle.setAttribute(
                "aria-label",
                dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
            );
            const sun = toggle.querySelector(".ph-sun-icon") as HTMLElement | null;
            const moon = toggle.querySelector(".ph-moon-icon") as HTMLElement | null;
            sun?.classList.toggle("hidden", dark);
            moon?.classList.toggle("hidden", !dark);
        }
    };
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(stored ? stored === "dark" : prefersDark);
    toggle?.addEventListener("click", () => {
        const isDark = document.documentElement.classList.contains("dark");
        applyTheme(!isDark);
    });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (!localStorage.getItem("theme")) applyTheme(e.matches);
    });

    const year = new Date().getFullYear();
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = String(year);

    document.documentElement.dataset.club = CLUB;
}

bind();
loadData("snapshot");
