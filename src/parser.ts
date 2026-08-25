import {
    type CalendarioData,
    dateToInt,
    type NoteCategory,
    type NoteInfo,
    normalizeKey,
    ROLE_LABELS,
} from "./core";
import { parseCsv } from "./csv";
import { parseSpanishDate } from "./dates";

const ROLE_SET = new Set<string>(ROLE_LABELS);

const ALIASES: Record<string, string> = {
    "karina rdz": "Karina Rodríguez",
    "luis alfredo higareda": "Alfredo Higareda",
    laura: "Laura Cisneros",
};

function cleanName(raw: string): string {
    return raw.replace(/\s+/g, " ").trim();
}

function buildCanonical(allRawNames: string[]): Map<string, string> {
    const groups = new Map<string, Map<string, number>>();

    for (const raw of allRawNames) {
        const cleaned = cleanName(raw);
        if (!cleaned) continue;
        const key = normalizeKey(cleaned);
        const counter = groups.get(key) ?? new Map<string, number>();
        counter.set(cleaned, (counter.get(cleaned) ?? 0) + 1);
        groups.set(key, counter);
    }

    const canonical = new Map<string, string>();
    for (const [key, counter] of groups) {
        let best = "";
        let bestCount = -1;
        for (const [display, count] of counter) {
            if (count > bestCount || (count === bestCount && display < best)) {
                best = display;
                bestCount = count;
            }
        }
        canonical.set(key, ALIASES[key] ?? best);
    }

    return canonical;
}

function classifyNote(note: string): NoteCategory | null {
    const lower = note.toLowerCase();

    // Exclude notes about specific speeches
    if (lower.includes("discurso de") || lower.includes("norma discurso")) {
        return null;
    }

    // Exclude specific person presentations
    if (lower.includes("presenta una") || lower.includes("presenta su")) {
        return null;
    }

    // Exclude educational notes
    if (lower.startsWith("educativa")) {
        return null;
    }

    // Exclude administrative notes
    if (lower.includes("sesion del comite") || lower.includes("espacios de discurso")) {
        return null;
    }

    // Classify notes
    if (
        lower.includes("posada") ||
        lower.includes("muertos") ||
        lower.includes("mexicana") ||
        lower.includes("independencia") ||
        lower.includes("años")
    ) {
        return "festividad";
    }
    if (lower.includes("descanso") || lower.includes("semana santa")) {
        return "feriado";
    }
    if (
        lower.includes("bohemia") ||
        lower.includes("discursos") ||
        lower.includes("debate") ||
        lower.includes("amistad")
    ) {
        return "tematico";
    }
    if (lower.includes("toma de protesta") || lower.includes("concurso")) {
        return "oficial";
    }
    if (lower.includes("atípica") || lower.includes("última")) {
        return "atipica";
    }

    return "tematico"; // default
}

export function parseCsvToData(text: string): CalendarioData {
    const rows = parseCsv(text);

    const dateRow = rows[1] ?? [];
    const dates: (Date | null)[] = [];
    let prev: Date | undefined;
    for (let i = 0; i < dateRow.length; i++) {
        const parsed = parseSpanishDate(dateRow[i], prev);
        dates.push(parsed);
        if (parsed) prev = parsed;
    }

    const roleIndex = new Map<string, number>();
    for (let i = 0; i < ROLE_LABELS.length; i++) {
        roleIndex.set(ROLE_LABELS[i], i);
    }

    const allRawNames: string[] = [];

    for (let r = 2; r < rows.length; r++) {
        const role = (rows[r][0] ?? "").trim();
        if (!ROLE_SET.has(role)) continue;
        const cells = rows[r];
        for (let c = 1; c < cells.length; c++) {
            const cell = (cells[c] ?? "").trim();
            if (!cell) continue;
            for (const n of cell.split(",").map((s) => cleanName(s))) {
                if (n) allRawNames.push(n);
            }
        }
    }

    const canonical = buildCanonical(allRawNames);
    const toCanonical = (name: string): string =>
        canonical.get(normalizeKey(name)) ?? cleanName(name);

    const byPerson = new Map<string, [number, number][]>();
    const seen = new Set<string>();

    for (let r = 2; r < rows.length; r++) {
        const role = (rows[r][0] ?? "").trim();
        const roleId = roleIndex.get(role);
        if (roleId === undefined) continue;

        const cells = rows[r];
        for (let c = 1; c < cells.length && c < dates.length; c++) {
            const date = dates[c];
            if (!date) continue;

            const cell = (cells[c] ?? "").trim();
            if (!cell) continue;

            const names = cell
                .split(",")
                .map((n) => cleanName(n))
                .filter(Boolean);
            for (const name of names) {
                const person = toCanonical(name);
                const dateInt = dateToInt(date);
                const key = `${dateInt}|${roleId}|${normalizeKey(person)}`;
                if (seen.has(key)) continue;
                seen.add(key);

                const list = byPerson.get(person) ?? [];
                list.push([dateInt, roleId]);
                byPerson.set(person, list);
            }
        }
    }

    for (const list of byPerson.values()) {
        list.sort((a, b) => a[0] - b[0]);
    }

    const persons = Array.from(byPerson.keys()).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" })
    );

    const index: Record<string, [number, number][]> = {};
    for (const p of persons) {
        index[normalizeKey(p)] = byPerson.get(p)!;
    }

    // Extract notes from the "Notas" row
    const notes: Record<number, NoteInfo> = {};
    const notesRowIndex = rows.findIndex((row) => row[0]?.trim().toLowerCase() === "notas");

    if (notesRowIndex !== -1) {
        const notesRow = rows[notesRowIndex];
        for (let c = 1; c < notesRow.length && c < dates.length; c++) {
            const note = notesRow[c]?.trim();
            const date = dates[c];

            if (note && date) {
                const category = classifyNote(note);
                if (category) {
                    const dateInt = dateToInt(date);
                    notes[dateInt] = { text: note, category };
                }
            }
        }
    }

    return {
        v: 1,
        roles: ROLE_LABELS,
        persons,
        index,
        notes,
    };
}
