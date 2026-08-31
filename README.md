# Toastmasters Guadalajara — Calendario de Participaciones

Aplicación estática que convierte el calendario publicado en Google Sheets en
participaciones filtrables, con **agregado 1-click a Google Calendar** y **PDF por bloques sin cortes**, respetando la identidad de marca de Toastmasters International (Manual 2025). 100 % cliente, sin backend. `.ics` queda oculto como fallback (`src/ics.ts`).

## Características

- 100 % cliente: sin backend, sin base de datos. `dist/calendario.json` con fallback si Sheets no responde (útil en CI).
- Pre-construye un índice por persona para consultas O(1).
- Filtro de participaciones futuras (zona horaria `America/Mexico_City`) con reactivación automática de `config/personas.json`.
- Eventos 20:00–22:00. Agregado por fecha a **Google Calendar 1-click** (`20:00–22:00 America/Mexico_City`) con recordatorio 14d discursos / 7d roles (ajustable en Google Calendar). `.ics` oculto disponible vía `window._hiddenDownloadIcs`.
- **PDF por bloques** (`html2canvas + jspdf`) sin cortes mid-card, paginado por `section.month`/`li.item`, header compacto, fondo blanco opaco anti-transparencia (funciona en light y dark).
- **Bento sticky 880px** (`380px filtro` + `1fr resultados`), más aire editorial, `header` con sombra tintada y grain `0.02`, `Phosphor` icons, `Actualizar` primario granate + `Descargar PDF` secundario igual tamaño (44px tappable).
- **Dark mode AA** (`html.dark` toggle sol/luna, `focus #F2DF74`, `card #1E2F3D`, badges/notas con 4.5:1).
- Diseño responsive con paleta Manual 2025: Azul Leal `#004165`, Granate `#772432`, Gris `#3D4F5A` (4.5:1), Amarillo `#F2DF74`, bone `#F7F6F3` sutil.
- Tipografías: Montserrat (encabezados, `text-wrap:balance`) y Source Sans 3 (texto, `tabular-nums`).
- `noindex,nofollow` + `robots.txt Disallow` (herramienta privada), `canonical` self-referencing.

## Estructura

```
src/
  build.ts    # CSV → JSON → bundle (Bun.build + tailwindcss) con fallback dist/calendario.json
  client.ts   # filtros, bento, PDF bloques (html2canvas+jspdf), google links, dark toggle
  core.ts     # tipos, roles, fechas, búsqueda binaria
  csv.ts      # parser CSV RFC4180
  dates.ts    # parser de fechas en español
  filter.ts   # exclusión y reactivación de personas
  ics.ts      # generador ICS (oculto, fallback)
  parser.ts   # CSV → CalendarioData compacto
  serve.ts    # preview estático local con Bun
  styles/globals.css # Tailwind v4 + tokens + editorial pulido + dark AA
config/
  personas.json # exclusiones e inclusiones manuales
public/
  index.html  # bento, copy Propuesta A, Phosphor, a11y
  robots.txt  # Disallow (privado)
docs/
  BRANDKIT.md # board 3×3 premium
  brand-kit-board.html # preview visual
vercel.json   # headers s-maxage 300 calendario.json, immutable app.js/css
.github/workflows/ci.yml # Biome + build (bun 1.3.4)
```

## Build local

```bash
bun run build
```

Genera `dist/calendario.json`, `dist/app.js` y `dist/index.html`. El build
consulta Google Sheets para generar el JSON; el navegador carga ese snapshot
al entrar y puede volver a consultar Google Sheets desde “Actualizar calendario”.

## Vista previa local

```bash
bun run dev
```

Abre `http://localhost:3000`. El comando vuelve a generar el build y
levanta un servidor estático usando Bun.

## Despliegue en Vercel

El proyecto está listo para `vercel deploy` (sin servidor). Vercel
ejecutará `bun run build` y servirá la carpeta `dist/` como sitio
estático.

```bash
vercel deploy --prod
```

## Actualizar el calendario

Para consultar cambios de Google Sheets sin redesplegar:

1. Actualiza la hoja publicada.
2. Abre la aplicación.
3. Pulsa “Actualizar calendario”.

La selección de una persona muestra sus participaciones automáticamente. Para
que Vercel genere un nuevo snapshot durante el deploy, basta con ejecutar el
build normal.

## Personas

`config/personas.json` controla qué personas aparecen en el JSON
publicado:

- `excluded`: personas que no deben aparecer.
- `included`: personas que siempre deben aparecer; tiene prioridad sobre
  `excluded`.

Una persona excluida se reactiva automáticamente si el CSV tiene una
participación desde hoy en adelante, usando `America/Mexico_City`.
La reactivación automática se recalcula en cada build.

## Aliases de nombres

`src/parser.ts` mantiene un mapa de alias conocido
(`Karina Rdz` → `Karina Rodríguez`,
`Luis Alfredo Higareda` → `Alfredo Higareda`,
`Laura` → `Laura Cisneros`). La normalización de acentos es
automática.

## Logotipo oficial

Cuando se disponga del SVG/PNG oficial, reemplaza el bloque
`#logo` en `public/index.html` por una etiqueta `<img>` con el
archivo del manual, conservando tamaño mínimo de 72 px en web.

## Aviso de marca

El pie de página contiene el descargo obligatorio del manual:

> The information on this website is for the sole use of Toastmasters'
> members, for Toastmasters business only. It is not to be used for
> solicitation and distribution of non-Toastmasters material or
> information.
