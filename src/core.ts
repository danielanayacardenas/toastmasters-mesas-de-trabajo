export const ROLE_LABELS = [
    "Toastmaster",
    "Topicsmaster",
    "Evaluador General",
    "Evaluador Gramatical",
    "Evaluador de Vacilaciones",
    "Cronometrador",
    "Contador de Votos",
    "Discurso 1",
    "Discurso 2",
    "Discurso 3",
    "Discurso 4",
    "Discurso 5",
    "Discurso 6",
    "Discurso 7",
    "Discurso 8",
    "Discurso 9",
    "Discurso 10",
] as const;

export const SPEECH_START = 7;
export const PREPARED_SPEECH_LABEL = "Discurso Preparado";

export function isSpeech(roleId: number): boolean {
    return roleId >= SPEECH_START;
}

export type NoteCategory = "festividad" | "feriado" | "tematico" | "oficial" | "atipica";

export interface NoteInfo {
    text: string;
    category: NoteCategory;
}

export interface CalendarioData {
    v: 1;
    roles: readonly string[];
    persons: string[];
    index: Record<string, [number, number][]>;
    notes: Record<number, NoteInfo>;
}

export type Participation = [number, number];

export function stripAccents(s: string): string {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeKey(name: string): string {
    return stripAccents(name).toLowerCase();
}

export function dateToInt(d: Date): number {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function intToDate(n: number): Date {
    const year = Math.floor(n / 10000);
    const month = Math.floor((n % 10000) / 100) - 1;
    const day = n % 100;
    return new Date(year, month, day);
}

const MONTHS_ES = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
];

export function formatDateLabel(d: Date): string {
    return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

export function formatMonthLabel(d: Date): string {
    const month = MONTHS_ES[d.getMonth()];
    return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${d.getFullYear()}`;
}

export function todayInt(timeZone = "America/Mexico_City"): number {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    const y = Number(parts.find((p) => p.type === "year")!.value);
    const m = Number(parts.find((p) => p.type === "month")!.value);
    const d = Number(parts.find((p) => p.type === "day")!.value);
    return y * 10000 + m * 100 + d;
}

export function lowerBound(arr: Participation[], target: number): number {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (arr[mid][0] < target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
