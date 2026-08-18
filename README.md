# Toastmasters Guadalajara — Calendario de Participaciones

Aplicación estática que convierte el calendario publicado en Google Sheets en
un archivo `.ics` descargable, respetando la
identidad de marca de Toastmasters International (Manual 2025).

## Características

- 100 % cliente: sin backend, sin base de datos.
- Pre-construye un índice por persona para consultas O(1).
- Filtro de participaciones futuras (zona horaria
  `America/Mexico_City`).
- Eventos 20:00–22:00 con VALARM `-P14D` para discursos y `-P7D` para
  los demás roles.
- Diseño responsive con la paleta del manual:
  Azul Leal `#004165`, Granate Verdadero `#772432`, Gris Fresco
  `#A9B2B1`, Amarillo Alegre `#F2DF74`.
- Tipografías: Montserrat (encabezados) y Source Sans 3 (texto).

## Estructura

```
src/
  build.ts    # orquesta CSV → JSON → bundle → HTML
  client.ts   # entrypoint del navegador
  core.ts     # tipos, roles, fechas, búsqueda binaria
  csv.ts      # parser CSV RFC4180
  dates.ts    # parser de fechas en español
  filter.ts   # exclusión y reactivación de personas
  ics.ts      # generador ICS
  parser.ts   # CSV → CalendarioData compacto
  serve.ts    # preview estático local con Bun
config/
  personas.json # exclusiones e inclusiones manuales
public/
  index.html  # UI de marca
vercel.json   # config de despliegue
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
