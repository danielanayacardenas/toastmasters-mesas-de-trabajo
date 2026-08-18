import { mkdir } from "node:fs/promises";
import { parseCsvToData } from "./parser";
import {
  DEFAULT_PERSONAS_CONFIG,
  filterPersons,
  type PersonasConfig,
} from "./filter";
import { GOOGLE_SHEETS_CSV_URL } from "./config";

const ROOT = `${import.meta.dir}/..`;
const PUBLIC_DIR = `${ROOT}/public`;
const DIST_DIR = `${ROOT}/dist`;
const CLIENT_ENTRY = `${ROOT}/src/client.ts`;
const HTML_ENTRY = `${PUBLIC_DIR}/index.html`;
const JSON_OUT = `${DIST_DIR}/calendario.json`;
const CONFIG_PATH = `${ROOT}/config/personas.json`;

async function exists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

async function copyHtml(): Promise<void> {
  const html = await Bun.file(HTML_ENTRY).text();
  await Bun.write(`${DIST_DIR}/index.html`, html);
}

async function loadPersonasConfig(): Promise<PersonasConfig> {
  if (!(await exists(CONFIG_PATH))) {
    console.log("• config/personas.json no existe, sin exclusiones");
    return DEFAULT_PERSONAS_CONFIG;
  }
  const text = await Bun.file(CONFIG_PATH).text();
  return JSON.parse(text) as PersonasConfig;
}

async function loadCalendarCsv(): Promise<string> {
  console.log("• Descargando calendario desde Google Sheets…");
  const response = await fetch(GOOGLE_SHEETS_CSV_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No se pudo descargar Google Sheets: HTTP ${response.status}`);
  }
  return response.text();
}

async function main(): Promise<void> {
  await mkdir(DIST_DIR, { recursive: true });

  console.log("• Parseando CSV…");
  const csv = await loadCalendarCsv();
  const parsed = parseCsvToData(csv);

  console.log(`  Personas en CSV: ${parsed.persons.length}`);
  console.log(`  Participaciones totales: ${Object.values(parsed.index).reduce((n, l) => n + l.length, 0)}`);

  const personasConfig = await loadPersonasConfig();
  const { data, stats } = filterPersons(parsed, personasConfig);

  console.log("• Aplicando filtro de personas…");
  console.log(`  Excluidas manualmente: ${stats.removed}`);
  if (stats.reactivated.length > 0) {
    console.log(`  Reactivadas por participación futura: ${stats.reactivated.length} (${stats.reactivated.join(", ")})`);
  }
  console.log(`  Personas activas publicadas: ${stats.active}`);

  console.log("• Escribiendo calendario.json…");
  await Bun.write(JSON_OUT, JSON.stringify(data));

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

  console.log("• Copiando index.html…");
  await copyHtml();

  console.log("✔ Build listo en", DIST_DIR);
}

await main();
