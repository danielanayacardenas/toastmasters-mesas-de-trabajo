import { mkdir } from "node:fs/promises";
import { GOOGLE_SHEETS_CSV_URL } from "./config";
import { DEFAULT_PERSONAS_CONFIG, filterPersons, type PersonasConfig } from "./filter";
import { parseCsvToData } from "./parser";

const ROOT = `${import.meta.dir}/..`;
const PUBLIC_DIR = `${ROOT}/public`;
const DIST_DIR = `${ROOT}/dist`;
const CLIENT_ENTRY = `${ROOT}/src/client.ts`;
const HTML_ENTRY = `${PUBLIC_DIR}/index.html`;
const CSS_ENTRY = `${ROOT}/src/styles/globals.css`;
const JSON_OUT = `${DIST_DIR}/calendario.json`;
const CONFIG_PATH = `${ROOT}/config/personas.json`;

async function exists(path: string): Promise<boolean> {
    return Bun.file(path).exists();
}

async function copyHtml(): Promise<void> {
    const html = await Bun.file(HTML_ENTRY).text();
    await Bun.write(`${DIST_DIR}/index.html`, html);
    // SEO: copy robots.txt if present (noindex intentional)
    const robotsSrc = `${PUBLIC_DIR}/robots.txt`;
    if (await exists(robotsSrc)) {
        const robots = await Bun.file(robotsSrc).text();
        await Bun.write(`${DIST_DIR}/robots.txt`, robots);
    }
}

async function loadPersonasConfig(): Promise<PersonasConfig> {
    if (!(await exists(CONFIG_PATH))) {
        console.log("• config/personas.json no existe, sin exclusiones");
        return DEFAULT_PERSONAS_CONFIG;
    }
    const text = await Bun.file(CONFIG_PATH).text();
    return JSON.parse(text) as PersonasConfig;
}

async function loadCalendarCsv(): Promise<string | null> {
    console.log("• Descargando calendario desde Google Sheets…");
    try {
        const response = await fetch(GOOGLE_SHEETS_CSV_URL, { cache: "no-store" });
        if (!response.ok) {
            console.warn(`⚠ No se pudo descargar Google Sheets: HTTP ${response.status}`);
            return null;
        }
        return await response.text();
    } catch (err) {
        console.warn("⚠ Error de red al descargar Google Sheets:", err);
        return null;
    }
}

async function main(): Promise<void> {
    await mkdir(DIST_DIR, { recursive: true });

    console.log("• Parseando CSV…");
    const csv = await loadCalendarCsv();
    let parsed: ReturnType<typeof parseCsvToData>;
    if (csv === null) {
        // Fallback: reuse previous dist/calendario.json if build is re-run without network (deploy-to-vercel skill: robust build)
        if (await exists(JSON_OUT)) {
            console.warn("⚠ Usando calendario.json previo como fallback (sin red)");
            const cached = await Bun.file(JSON_OUT).text();
            parsed = JSON.parse(cached) as ReturnType<typeof parseCsvToData>;
            // Ensure notes field exists for backwards compat
            if (!parsed.notes) parsed.notes = {} as never;
        } else {
            throw new Error(
                "No se pudo descargar Google Sheets y no existe dist/calendario.json previo para fallback"
            );
        }
    } else {
        parsed = parseCsvToData(csv);
    }

    console.log(`  Personas en CSV: ${parsed.persons.length}`);
    console.log(
        `  Participaciones totales: ${Object.values(parsed.index).reduce((n, l) => n + l.length, 0)}`
    );

    const personasConfig = await loadPersonasConfig();
    const { data, stats } = filterPersons(parsed, personasConfig);

    console.log("• Aplicando filtro de personas…");
    console.log(`  Excluidas manualmente: ${stats.removed}`);
    if (stats.reactivated.length > 0) {
        console.log(
            `  Reactivadas por participación futura: ${stats.reactivated.length} (${stats.reactivated.join(", ")})`
        );
    }
    console.log(`  Personas activas publicadas: ${stats.active}`);

    console.log("• Escribiendo calendario.json…");
    // Embed build metadata for client freshness (deploy-to-vercel: cache-busting, SEO)
    const outData = { ...data, _meta: { builtAt: new Date().toISOString() } } as typeof data & {
        _meta: { builtAt: string };
    };
    await Bun.write(JSON_OUT, JSON.stringify(outData));

    const clientExists = await exists(CLIENT_ENTRY);
    if (clientExists) {
        console.log("• Compilando cliente…");
        const result = await Bun.build({
            entrypoints: [CLIENT_ENTRY],
            outdir: DIST_DIR,
            target: "browser",
            format: "esm",
            minify: true,
            naming: "app.js",
        });
        if (!result.success) {
            for (const log of result.logs) console.error(log);
            throw new Error("Fallo la compilación del cliente");
        }
    } else {
        console.log("• src/client.ts aún no existe, se omite el bundle del cliente");
    }

    // Tailwind v4: compilar globals.css -> dist/globals.css (híbrido @apply)
    if (await exists(CSS_ENTRY)) {
        console.log("• Compilando CSS con Tailwind…");
        const proc = Bun.spawn(
            ["bunx", "tailwindcss", "-i", CSS_ENTRY, "-o", `${DIST_DIR}/globals.css`, "--minify"],
            { stdout: "inherit", stderr: "inherit" }
        );
        const exit = await proc.exited;
        if (exit !== 0) throw new Error(`Tailwind build falló con código ${exit}`);
    } else {
        console.log("• src/styles/globals.css no existe, se omite CSS");
    }

    console.log("• Copiando index.html…");
    await copyHtml();

    console.log("✔ Build listo en", DIST_DIR);
}

await main();
