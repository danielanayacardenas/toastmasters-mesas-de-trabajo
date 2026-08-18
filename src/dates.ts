const MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const MONTH_RE = new RegExp(
  "(" + Object.keys(MONTHS).join("|") + ")\\w*",
  "i",
);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toMonthKey(s: string): number {
  const lower = stripAccents(s.toLowerCase());
  for (const key of Object.keys(MONTHS)) {
    if (lower.startsWith(key)) {
      return MONTHS[key];
    }
  }
  return -1;
}

/**
 * Parses Spanish dates like:
 *   "4 de julio de 2023"
 *   "18 febrero de 2025"
 *   "06 enero 2026"
 *   "5 de Agosto de 2025"
 *   "2 de Septiembre 2025"
 *   "9 de septiembre"          (no year)
 *   "19 marzo (miércoles)"     (no year, with note)
 *
 * `prev` is the previous date parsed, used to infer a missing year.
 * Returns a Date (local midnight) or null.
 */
export function parseSpanishDate(raw: string, prev?: Date): Date | null {
  if (!raw) return null;

  const cleaned = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  const tokens = cleaned.split(" ").filter((t) => t.toLowerCase() !== "de");

  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  for (const token of tokens) {
    const asInt = parseInt(token, 10);
    if (!Number.isNaN(asInt)) {
      if (asInt >= 1 && asInt <= 31) {
        day = asInt;
      } else {
        year = asInt;
      }
    } else {
      const m = toMonthKey(token);
      if (m >= 0 && month === null) {
        month = m;
      }
    }
  }

  if (day === null || month === null) {
    return null;
  }

  if (year === null) {
    if (prev) {
      year = prev.getFullYear();
      const candidate = new Date(year, month, day);
      if (candidate < prev && prev.getTime() - candidate.getTime() > 180 * 24 * 60 * 60 * 1000) {
        year += 1;
      }
    } else {
      return null;
    }
  }

  if (year < 1900 || year > 2200) {
    return null;
  }

  const result = new Date(year, month, day);
  if (result.getMonth() !== month || result.getDate() !== day) {
    return null;
  }

  return result;
}
