# Plan de Implementación

## Objetivo

Crear una aplicación estática para Vercel que permita a los miembros de
Toastmasters Guadalajara seleccionar su nombre, consultar sus
participaciones, filtrar solo las futuras y descargar un archivo ICS,
sin backend y en la zona horaria `America/Mexico_City`.

## Arquitectura

- Bun se usa durante el build y la aplicación también puede procesar el CSV
  remoto cuando el usuario solicita una actualización.
- El build consulta el CSV publicado en Google Sheets.
- El resultado es un JSON compacto, filtrado e indexado que el navegador descarga.
- Google Sheets también se conserva como fuente runtime para “Actualizar calendario”.
- La generación del ICS ocurre en el cliente.
- Vercel sirve únicamente los archivos de `dist/`.

## Build

`bun run build` ejecuta `src/build.ts` que:

1. Descarga el CSV publicado en Google Sheets.
2. Parsea fechas y roles.
3. Normaliza nombres.
4. Construye el índice por persona.
5. Escribe `dist/calendario.json`.
6. Compila `src/client.ts` con `Bun.build`.
7. Copia `public/index.html` a `dist/index.html`.

## JSON compacto

```json
{
    "v": 1,
    "roles": ["Toastmaster", "Topicsmaster", "..."],
    "persons": ["Daniel Anaya"],
    "index": {
        "daniel anaya": [
            [20260818, 0],
            [20260915, 7]
        ]
    }
}
```

- Fechas como `YYYYMMDD` numérico.
- Roles como IDs numéricos (`Discurso N` desde 12).
- Participaciones ordenadas por fecha.

## Archivos

- `src/core.ts` — tipos, roles, IDs, normalizeKey, `todayInt`, `lowerBound`.
- `src/parser.ts` — `parseCsvToData(text): CalendarioData`.
- `src/ics.ts` — genera ICS desde `[YYYYMMDD, roleId]`.
- `src/build.ts` — orquesta Google Sheets → JSON → bundle → copia HTML.
- `src/client.ts` — carga JSON, actualiza desde Google Sheets, filtra, renderiza y descarga ICS.
- `src/filter.ts` — aplica exclusiones, inclusiones y reactivación futura.
- `src/serve.ts` — preview estático local con Bun.
- `config/personas.json` — exclusiones e inclusiones persistentes.
- `public/index.html` — UI con marca Toastmasters Guadalajara.

## Marca (Manual 2025)

### Colores

- Azul Leal: `#004165`
- Granate Verdadero: `#772432`
- Gris Fresco: `#A9B2B1`
- Amarillo Alegre: `#F2DF74`
- Gris Claro: `#F5F5F5`

### Tipografías

- Headings: Montserrat.
- Texto: Source Sans 3.
- Fallbacks: Arial, Segoe UI, sans-serif.

### Aplicación

- Encabezado azul, club "Toastmasters Guadalajara".
- Botón principal granate, secundario azul.
- Amarillo para acentos (filtros, recordatorios).
- Discursos en granate, otros roles en azul.
- Fondo `#F5F5F5`, tarjetas blancas.
- Sin modo oscuro automático.
- Responsive.

## Logotipo

Sin logo oficial disponible. Se reserva el espacio. No se recrea.

## Footer

> The information on this website is for the sole use of Toastmasters'
> members, for Toastmasters business only. It is not to be used for
> solicitation and distribution of non-Toastmasters material or
> information.

## Vercel

`dist/` es el artefacto de producción. Vercel no usa `Bun.serve`, rutas
`/api` ni backend. `src/serve.ts` solo proporciona un preview estático
local con Bun.

## Personas

- `excluded`: personas que no se publican.
- `included`: personas que siempre se publican y tienen prioridad.
- Una persona excluida se reactiva automáticamente si tiene una
  participación desde hoy en adelante.
- La fecha de reactivación usa `America/Mexico_City`.

## Verificación

- `bun run build` genera `dist/`.
- JSON con las personas permitidas por `config/personas.json`.
- Filtro `hoy` en `America/Mexico_City`.
- ICS 20:00–22:00, `-P14D` discursos, `-P7D` otros.
- Descarga desde navegador.

## Actualización del calendario

1. Actualizar la hoja publicada.
2. Pulsar “Actualizar calendario” en la aplicación.
3. Seleccionar una persona; sus resultados se muestran automáticamente.
