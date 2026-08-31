# Brand Kit — Toastmasters Guadalajara — Calendario (v2)

> Source: `Manual_de_Marca_Toastmasters_2025.pdf` + v2 decisions (bento, bone subtle, Phosphor)
> Canvas: Quiet Premium Neutral (not Dark Developer) per `brandkit/SKILL.md:437` Light Editorial variant + Toastmasters heritage

## Strategy First (brandkit:99-112)

| Dim | Decision |
|---|---|
| Category | Productivity / community service tool (member-only utility) |
| Audience | Socios Toastmasters Guadalajara, admin, VPE |
| Product function | Filtrar participaciones futuras (America/Mexico_City) + generar ICS con VALARM 14d/7d |
| Emotional promise | Claridad, puntualidad, pertenencia |
| Cultural position | Institucional confiable, no marketing hype |
| Trust level | High — fechas oficiales, zona horaria explícita |
| Visual world | Light editorial + precise app chrome (cards 12px, border #EAEAEA) + subtle warm-bone grain 0.02 |
| Core metaphor | **Path + Seal** — camino de crecimiento sellado por la institución (sello, trazo, marca de fecha) |
| Avoid | AI-purple gradients, neon, glassmorphism excesivo, inter genérico, emojis, pill-full containers |

## Palette (locked, design-taste color consistency lock)

- Loyal Blue `#004165` (--loyal-blue) — header, roles, links, icon-btn hover (`src/styles/globals.css:20`)
- Loyal Deep `#002F47` — header gradient, footer bg
- True Maroon `#772432` / deep `#5A1C26` — discursos, primary CTA
- Cool Gray `#3D4F5A` (a11y 4.5:1) — muted text, ghost btn
- Happy Yellow `#F2DF74` — accent border header 4px, next-event left border
- Fair Gray `#F5F5F5` (canvas) + Bone `#F7F6F3` (subtle grain overlay, skeleton shimmer only)
- Card `#FFFFFF`, Border `#EAEAEA` (1px flat per minimalist-ui:45)
- Notes: festividad `#F3E5F5/#6A1B9A` etc. — semantic only, not palette expansion

Use ONE accent per context: blue for roles/nav, maroon for speech/primary, yellow for highlight. No random triple accent.

## Typography (brand mandated, refined)

- Headings: Montserrat 500/600/700, tight tracking `-0.02em` on `.site-title` (`globals.css:146`), `text-wrap:balance`
- Body: Source Sans 3 400/600, `line-height 1.55`, `tabular-nums` on dates, `text-wrap:pretty` on lede
- Fallbacks: Arial, Segoe UI
- No Inter/Roboto/Geist swap — brand overrides minimalist-ui suggestion

## Logo (placeholder until official SVG available per README:104)

Current `#logo` (`public/index.html:42`) is `TOASTMASTERS INTERNATIONAL` text placeholder 96x96 white card with yellow border. Replacement spec:

Concept methods combined: **Monogram TM + Seal + Path**
- TM ligature (geometric, negative-space cut) + circular seal border (2px) + small path notch at SE (growth arrow)
- Usable as 32x32 favicon (TM on loyal-blue), 96x96 card, wordmark horizontal
- Favicon implemented as data-uri (`index.html:37`): loyal-blue 32px rounded 8 with TM yellow text — matches manual min 72px rule scaled

When official SVG/PNG arrives: replace `#logo` with `<img alt="Toastmasters International" width="96" height="96">`, keep 72px min, keep yellow border.

## 3×3 Panel System (brandkit:272-307)

Default `3×3` board, 16:10, strong gutters, dark charcoal outer canvas (#121212) per Reference Style DNA, inner panels warm white.

1. **Logo Cover** — TM seal on deep blue, wordmark, generous negative space
2. **Logo Construction** — grid: circle + diagonal cut + TM letterform, alignment marks, x-height
3. **Digital Application** — browser chrome mock of `bento__filter` card (select + email field + maroon CTA)
4. **Brand Essence** — tagline `“Tu próxima palabra, a tiempo.”` large Montserrat 700
5. **Color System** — swatches loyal/maroon/yellow/cool-gray + note semantic chips
6. **Typography** — Montserrat A-Z specimen + Source Sans 3 body at 17px/1.55
7. **Physical Application** — card/badge mock (member card with TM seal emboss)
8. **Image Direction** — Guadalajara evening, desaturated warm grain 0.02, no stock office
9. **System Detail** — badge row (speech vs role), icon-btn 44px, focus ring #765F00, skeleton shimmer

Alternative `2×3` cinematic deck version exists as `docs/brand-kit-board.html` (open in browser).

## Generation Prompt (brandkit:739 template)

```
Create a premium brand-kit overview image for "Toastmasters Guadalajara — Calendario".

Brand strategy:
- category: community productivity / education
- audience: Toastmasters members, trust-first
- personality: precise, warm, institutional, calm
- core metaphor: path sealed by institution (seal + path notch)
- logo idea: TM monogram fused with circular seal + southeast path cut = growth within trust

Layout: 3×3 grid on dark charcoal canvas with strong gutters, clean alignment, refined negative space.

Panels: logo cover, logo construction, digital application (bento filter card), tagline, color system, typography, physical card, image direction (warm evening desaturated), system detail (badges + 44px icon-btn).

Visual mode: Light Editorial / Compliance (ivory paper, deep blue/red/gold accents, seals)

Palette: #004165 loyal-blue, #772432 maroon, #F2DF74 yellow, #F5F5F5 fair-gray, #F7F6F3 bone subtle, #3D4F5A cool-gray, #EAEAEA border

Typography: Montserrat 700 + Source Sans 3 400/600, sparse, large, readable.

Logo: simple, memorable, geometric seal, ownable, repeated consistently.

Style: premium, sparse, cinematic, intentional, polished, brand-guidelines deck.
```

Run with any image-gen tool (or keep HTML board) before coding new marketing pages.

## Implementation Notes (v2)

- Tokens in `src/styles/globals.css:3-44` (@theme) + `:root` z-scale
- Grain via `body::before` fixed 256px noise 0.02 opacity, pointer-events none (performance: fixed, not scrolling)
- Bento: `main.bento` grid 380px sticky filter (`globals.css:161-185`)
- Icons: Phosphor Web `@phosphor-icons/web` via unpkg (`index.html:36`), single family (sun/moon/calendar-plus/calendar-blank)
- Skeleton: `.skeleton` shimmer matching card radius (globals.css) + `aria-busy` in `src/client.ts:112`
- Empty state: Phosphor `ph-calendar-blank` + helper text (`client.ts:379`)
- SEO: kept `noindex,nofollow` + `robots.txt Disallow` + `X-Robots-Tag` (no JSON-LD per decision Skip minimal)
- Favicon: data-uri TM (index.html:37)
- Dark mode: `html.dark` toggle via `localStorage` + `prefers-color-scheme` (`client.ts:486`)

## References

- Manual de Marca Toastmasters 2025 (PDF in repo root)
- `.agents/skills/brandkit/SKILL.md:272` panel system
- `.agents/skills/minimalist-ui/SKILL.md:31` warm monochrome
- `.agents/skills/design-taste-frontend/SKILL.md:160` anti-slop
- `public/index.html:12` noindex rationale
