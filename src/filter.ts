import { type CalendarioData, lowerBound, normalizeKey, todayInt } from "./core";

export interface PersonasConfig {
    excluded: string[];
    included: string[];
}

export interface FilterStats {
    removed: number;
    reactivated: string[];
    active: number;
}

export const DEFAULT_PERSONAS_CONFIG: PersonasConfig = {
    excluded: [],
    included: [],
};

/**
 * Regla de visibilidad:
 *   visible = aparece en `included`
 *     || no aparece en `excluded`
 *     || tiene una participación con fecha >= hoy (reactivación automática)
 *
 * La reactivación es automática pero no permanente: si la participación
 * futura desaparece en una actualización posterior, la persona vuelve a
 * quedar excluida. Para incluirla permanentemente se usa `included`.
 */
export function filterPersons(
    data: CalendarioData,
    cfg: PersonasConfig,
    timeZone = "America/Mexico_City"
): { data: CalendarioData; stats: FilterStats } {
    const today = todayInt(timeZone);
    const excludedKeys = new Set(cfg.excluded.map(normalizeKey));
    const includedKeys = new Set(cfg.included.map(normalizeKey));

    const keep = new Map<string, [number, number][]>();
    const reactivated: string[] = [];
    let removed = 0;

    for (const person of data.persons) {
        const key = normalizeKey(person);
        const list = data.index[key] ?? [];
        const isIncluded = includedKeys.has(key);
        const isExcluded = excludedKeys.has(key) && !isIncluded;

        if (isExcluded) removed++;

        const future = list.slice(lowerBound(list, today));

        // El artefacto publicado no necesita conservar el historial.
        if (future.length === 0) continue;

        if (isIncluded) {
            keep.set(person, future);
            continue;
        }

        if (!isExcluded) {
            keep.set(person, future);
            continue;
        }

        keep.set(person, future);
        reactivated.push(person);
    }

    const persons = Array.from(keep.keys()).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" })
    );

    const index: Record<string, [number, number][]> = {};
    for (const p of persons) index[normalizeKey(p)] = keep.get(p)!;

    return {
        data: { ...data, persons, index },
        stats: {
            removed,
            reactivated,
            active: persons.length,
        },
    };
}
