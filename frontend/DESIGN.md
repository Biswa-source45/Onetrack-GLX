---
name: OneTrack — The Ledger
description: A bid-finance ledger world for the landing and login pages only — white paper ground, blue rule lines, one blue ink-stamp accent.
colors:
  ground: "#FFFFFF"
  ground-deep: "#F3F6FC"
  surface: "#FFFFFF"
  surface-raised: "#EAF1FC"
  rule: "#D7E2F2"
  rule-bright: "#6D8FC9"
  accent: "#2563EB"
  accent-bright: "#3B82F6"
  accent-deep: "#1D4ED8"
  alert: "#DC2626"
  text: "#101828"
  text-muted: "#47536B"
  text-faint: "#667289"
  border: "#E4EAF5"
  border-bright: "#C7D6EC"
  deep-panel: "#1E3A8A"
  deep-panel-raised: "#24439C"
  deep-panel-rule: "#33478A"
  deep-panel-text: "#FFFFFF"
  deep-panel-muted: "#BFDBFE"
  deep-panel-mark: "#7DD3FC"
typography:
  display:
    fontFamily: "'Zilla Slab', Georgia, serif"
    fontWeight: 600
    lineHeight: 1.1
  body:
    fontFamily: "'Public Sans', system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontWeight: 500
    letterSpacing: "0.02em"
rounded:
  sm: "3px"
  md: "4px"
  lg: "5px"
  xl: "6px"
  xxl: "8px"
spacing:
  row-dense: "10px"
  row: "14px"
  section-y: "80px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent-deep}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  input-field:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
---

# Design System: OneTrack — The Ledger

## Overview

**Creative North Star: "The Ledger"**

The Ledger renders the product's own ten-stage bid pipeline as a real, open finance ledger rather than a dashboard borrowing tender vocabulary: a white paper ground, blue rule lines like a cash-book page, and one blue ink-stamp mark reserved for what has actually been reached. The world's single repeating grammar unit — a ruled row with a code, a title, a note, and a status mark (`LedgerRow`) — is reused across the landing hero register, the capability list, and the pipeline register, so the page teaches its own vocabulary once and then repeats it rather than switching card patterns per section. Motion is restrained and diegetic: a completed row's stamp strikes with a small spring on mount, an active row pulses a single ring — the interaction budget is "the stamp strike," not a different animation per component.

This world is intentionally confined to two surfaces — `Landing.jsx` and `Login.jsx` — plus the shared `src/lib/Ledger*.jsx` and `ledgerTheme.js` files that back them. Every color and font here is a literal value authored in `ledgerTheme.js`, never the app-wide `--background`/`--primary`/`--font-*` custom properties defined in `App.css`. The rest of the application (dashboard, tender workspace, admin, analytics) uses that separate, untouched CSS-custom-property theme and is out of scope for this document.

The palette was repaletted once during the build: an initial dark-graphite-ground/brass-accent draft was replaced, on explicit direction after review, with the current white-paper/blue-ink palette — the same blue family the rest of the app already uses at `~blue-600`. The dark/brass draft never shipped and is not part of this system.

**Key Characteristics:**
- White paper ground with thin blue rule lines standing in for ledger-pad lines.
- One accent color (blue ink) reserved for what is reached, active, or actionable — never decorative.
- One repeating row grammar (`LedgerRow`) instead of a different card shape per section.
- One recurring glyph, the circular stamp/check mark (`LedgerStampMark`), never a set of varied icons.
- Geometric, hand-authored abstract marks (concentric rings, offset arcs) built from the same rule-line material as the ledger itself — never a stock gradient blob or a literal screenshot of the live pipeline.

## Colors

A near-monochrome white-and-blue palette: the ground carries almost no color, so the single blue ink accent reads as legible signal rather than decoration.

### Primary
- **Ink Blue** (`#2563EB`): the one accent — primary CTA fill, the reached-row stamp, active-row pulse, selected-row code, active links. Reserved for what's actually reached or actionable.
- **Ink Blue Deep** (`#1D4ED8`): pressed/shadow-lip state under the primary button, selected entry labels, badge text.
- **Ink Blue Bright** (`#3B82F6`): secondary stroke weight inside the authored abstract marks (the fainter of two concentric arcs).

### Neutral
- **Paper White** (`#FFFFFF`): the base ground and card surface for both pages.
- **Paper Tint** (`#F3F6FC`): alternate section background, used to separate the capability and role registers from the white hero/pipeline sections without a hard border.
- **Ledger Wash** (`#EAF1FC`): raised/hover surface — badge chips, wordmark tile background, role avatar ring fill.
- **Rule Line** (`#D7E2F2`): the resting divider under every `LedgerRow` and section rule — the ledger-pad line itself.
- **Rule Line Bright** (`#6D8FC9`): the divider color under a selected pipeline row, and the general card/button border-bright value (`#C7D6EC` is the button/card border; `#6D8FC9` is reserved for the active rule state).
- **Ink Text** (`#101828`): primary heading and row-title color.
- **Ink Text Muted** (`#47536B`): body copy, notes, secondary labels.
- **Ink Text Faint** (`#667289`): row codes, pending-status labels, footnote-scale text.
- **Card Border** (`#E4EAF5`): resting border on headers, footers, dividers between page chrome.
- **Card Border Bright** (`#C7D6EC`): border on raised cards, buttons, and badges that need more definition than a resting divider.
- **Alert Red** (`#DC2626`): declared in `ledgerTheme.js` but not drawn on by either shipped page today — reserved for a genuine overdue/attention state, not decorative.

### Deep Panel (login left panel only)
- **Deep Ledger Blue** (`#1E3A8A`): the login page's left panel ground — the same brand blue at full ink saturation, paired against the white "entry" panel on the right as a register page facing a blank form page.
- **Deep Panel Raised** (`#24439C`): the wordmark tile background inside the deep panel.
- **Deep Panel Rule** (`#33478A`): rule lines and the abstract composition's ring strokes on the deep panel.
- **Deep Panel Text** (`#FFFFFF`): headline and wordmark text on the deep panel.
- **Deep Panel Muted** (`#BFDBFE`): the deep panel's supporting paragraph copy.
- **Deep Panel Mark** (`#7DD3FC`): the glow core and brightest stroke in the login panel's abstract artwork, and the stamp glyph color when it sits on the deep panel.

### Named Rules
**The One Accent Rule.** `#2563EB` is the only color in the system that means "reached, active, or actionable." It never appears as pure decoration — every instance of ink blue on either page marks a stamped row, an active pulse, a CTA, or a live link.

**The One Row Rule.** Every list-like unit that isn't the role list (hero pipeline snapshot, capability list, full pipeline register) is the same `LedgerRow` component — a code, a title, an optional note, and a status mark on the right, divided by a resting rule line. New list content on these two surfaces should reuse `LedgerRow`, not invent a card shape.

## Typography

**Display Font:** Zilla Slab (with Georgia, serif fallback)
**Body Font:** Public Sans (with system-ui, sans-serif fallback)
**Label/Mono Font:** JetBrains Mono (with ui-monospace, monospace fallback)

**Character:** A slab-serif display face gives headlines and row titles a ledger-book, typewritten-register weight; Public Sans keeps body copy and UI chrome plain and legible; JetBrains Mono is reserved for anything that reads as an entered value — tender codes, row codes, OTP digits, stat figures — so numbers and IDs visually behave like data, not prose.

### Hierarchy
- **Display** (600, `text-4xl`–`text-5xl`/2.25–3rem, 1.08 line-height): hero headlines, section headings, login "Welcome Back" and left-panel headline — all in Zilla Slab.
- **Title** (500–600, `text-lg`–`text-3xl`, 1.1–1.2): row titles inside `LedgerRow` (Zilla Slab, 0.95rem dense / 1.05rem regular), pipeline detail card stage name, role titles.
- **Body** (400, `text-sm`/0.875rem, 1.5–1.6 relaxed): paragraph copy, row notes, form labels' supporting text — Public Sans.
- **Label** (600–700, 10–11px, wide tracking, uppercase where used): badges ("Full Access", "Gate enforced"), footer column headers, OTP step captions — Public Sans, uppercase tracking-wide.
- **Mono/Data** (500, 11px–lg tabular-nums): tender identifiers, row codes ("01"–"10"), OTP digit input, hero stat figures — JetBrains Mono, always `tabular-nums`.

### Named Rules
**The Data-Is-Mono Rule.** Anything that is an entered value rather than authored prose — a stage code, a tender ID, a stat number, an OTP digit — renders in JetBrains Mono with tabular figures. Zilla Slab and Public Sans never carry a number that represents ledger data.

## Layout

Both surfaces are centered, single-column-of-sections compositions on a max-width container (landing: `max-w-6xl` nav/hero, `max-w-3xl`–`max-w-4xl` for the register sections; login: a single `max-w-4xl`, fixed-aspect two-column card capped at `560px` tall). Landing sections alternate `ground` (white) and `groundDeep` (#F3F6FC) backgrounds to separate registers without hard borders, at a consistent `py-20` (80px) rhythm. `LedgerRow` itself sets the internal list rhythm: `py-3.5` (14px) per row in regular density, `py-2.5` (10px) in the hero's dense snapshot, each row full-width with a code / title-and-note / status-mark three-part horizontal layout. The login page is a single fixed-height split card (not a scrolling page): a hidden-below-`md` left art panel (46–48% width) paired with a white right-hand form panel (52–54% width) that scrolls internally if content overflows. Responsive collapse is consistent: the login left panel and landing's desktop nav both disappear below `md`, with the login form panel going full width and the landing nav becoming a slide-down mobile menu.

## Elevation & Depth

The world is mostly flat — rule lines, not shadows, are the primary way rows and sections separate from each other. Shadows are reserved for surfaces that float above the page: raised cards (the hero register card, the pipeline detail card, the login card, the OTP modal) each carry one soft, large-radius ambient shadow, and the primary button carries a small structural lip shadow that reads as a stamped edge rather than a floating card.

### Shadow Vocabulary
- **Card ambient** (`box-shadow: 0 24px 60px -24px rgba(16,24,40,0.18)` on the hero register card, `0 16px 40px -20px rgba(16,24,40,0.14)` on the pipeline detail card): a soft, diffuse lift under any card floating over a section background.
- **Login card ambient** (`box-shadow: 0 32px 80px -24px rgba(16,24,40,0.28)`): the same family at higher intensity for the login card and its OTP modal, which sit over a plain white page with nothing else to anchor them.
- **Button lip** (`box-shadow: 0 1px 0 {accentDeep}` combined with a larger blue-tinted glow `0 10px 22px -8px rgba(37,99,235,0.45)` on the landing CTA): a 1px solid ink-blue edge under the primary button plus a soft blue glow — reads as a physically stamped, slightly embossed button rather than a hovering card.

### Named Rules
**The Rule-Over-Shadow Rule.** Inside a register or list, adjacency is shown with a 1px rule line (`#D7E2F2`, brightening to `#6D8FC9` on selection), never a shadow or card boundary. Shadows are reserved for a surface floating above the page as a whole (cards, modals, the primary CTA), not for separating list rows from each other.

## Shapes

Corners are small and consistent rather than fully square or heavily rounded: `3px` on badges and small chips, `4px` on inputs and buttons, `5px` on the wordmark tile and ghost button, `6px` on the login page's inner panels, `8px` on outer cards (hero register, pipeline detail, login card, modal). Borders are hairline (1px) throughout, using the `rule`/`border`/`border-bright` neutrals rather than the accent color except when a border is standing in for an active/selected state. The one recurring non-rectangular silhouette is the circle: the stamp-mark glyph, role-avatar rings, status dots (pending/active/reached), and the concentric-ring abstract compositions on both the landing hero and the login panel all use true circles and circular arcs — never a superellipse, blob, or freeform organic shape.

## Components

### Buttons
- **Shape:** small rounded corners (`5px`), consistent across primary and ghost variants.
- **Primary (`StampButton`):** ink-blue fill (`#2563EB`), white text, Public Sans semibold, `px-5 py-2.5` (regular) or `px-6 py-3.5` (large), with the button-lip shadow described above. Used for every "Sign In to the Ledger" / "Open Dashboard" / form-submit action on both pages.
- **Ghost:** transparent background, 1px `border-bright` (`#C7D6EC`) border, ink text, no fill — used for secondary nav actions ("Sign In", "Open the register") that shouldn't compete with the primary CTA.
- **Hover / Focus / Active:** primary buttons scale to `0.98` on tap (`whileTap`); form buttons use a `focus:ring-2` in accent blue via the `--tw-ring-color` custom property. Disabled states drop to 50% opacity.

### Cards / Containers
- **Corner Style:** `8px` for outer cards (hero register, pipeline detail card, login card, OTP modal), `6px` for the login page's inner left/right panels.
- **Background:** white (`#FFFFFF`) surface on `groundDeep`/`ground` page backgrounds; `surfaceRaised` (#EAF1FC) for inline highlight blocks (e.g. the closing-CTA panel).
- **Shadow Strategy:** see Elevation & Depth — ambient ombré shadow, no hard offset.
- **Border:** 1px `border-bright` (#C7D6EC) hairline on every raised card.
- **Internal Padding:** `p-5`–`p-6` (20–24px) on register/detail cards, `p-8`–`p-10` (32–40px) on the closing CTA panel.

### Inputs / Fields
- **Style:** white background, 1px `border` (#E4EAF5) hairline stroke, `4px` radius, `px-3.5 py-2.5` (14px/10px) padding, Public Sans medium at 12px (`text-xs`).
- **Focus:** a `focus:ring-2` in ink blue (`#2563EB` via `--tw-ring-color`), no border-color shift — the ring is the sole focus signal.
- **Special case:** the OTP digit field uses JetBrains Mono at `text-lg`, bold, center-aligned, wide letter-tracking, distinguishing an entered-code field from ordinary text entry.

### Navigation
- **Style:** a sticky top bar that goes from transparent-white to a translucent, blurred white (`rgba(255,255,255,0.9)` + `backdrop-filter: blur(8px)`) past a 12px scroll threshold; Public Sans medium nav links in `textMuted`, no visible active-state underline; mobile collapses to a slide-down panel with the same link list stacked above the primary CTA.

### The Ledger Row (signature component)
`LedgerRow` (in `src/lib/LedgerRow.jsx`) is the world's one repeating list grammar: a monospace code, a Zilla Slab title with an optional Public Sans note beneath it, and a right-aligned status mark, divided from the row below it by a 1px rule line. Status has three states — `pending` (a dim open circle outline), `active` (a small filled dot with a looping pulse ring), and `reached` (the `LedgerStampMark` glyph springing in with a slight counter-rotation on mount). It is reused verbatim across the landing hero's illustrative snapshot register, the capability list, and the full interactive pipeline register (where clicking a row selects it and brightens its rule line). The role list on the landing page is the one list that does **not** use `LedgerRow**: `RoleSection` renders each role as a plain flex `div` with a circular initials avatar, a Zilla Slab title, a Public Sans note, and a badge chip on the right — visually similar in rhythm (same row height, same rule-line divider) but a distinct, simpler markup with no code column and no status mark.

### The Ledger Stamp Mark (signature component)
`LedgerStampMark` (in `src/lib/ledgerMarks.jsx`) is the world's one recurring glyph: a single circle with a checkmark stroke, rendered at icon scale (16–20px). It appears as the wordmark's tile icon on both pages, as every `reached` row's status mark, and inside the login panel's abstract composition as a small accent dot — never as a large plate or hero-scale illustration on its own.

### The Login Abstract Panel (signature component)
`LedgerAbstract` (in `src/lib/LedgerAbstract.jsx`), composed inside `LoginHeroPanel`, is the current and only shipped content of the login page's left panel: a full-bleed, slowly counter-rotating composition of concentric rings and offset arcs in the brand blue family, with two soft radial glows, rendered over the `deepPanel` ground and legibility-washed at top and bottom for the wordmark and headline. It shares its ring-and-arc vocabulary with the landing hero's `AbstractMark`, so the two pages read as one world without literally repeating the pipeline register on the login screen.

## Do's and Don'ts

### Do:
- **Do** treat `#2563EB` as the only color that signals "reached / active / actionable" on these two pages; every other color is structural (ground, rule, text) or role-specific to the deep panel.
- **Do** reuse `LedgerRow` for any new list content added to the landing page's registers (capabilities, pipeline) rather than introducing a new card shape.
- **Do** keep numbers and IDs (stage codes, tender identifiers, OTP digits, stat figures) in JetBrains Mono with tabular figures.
- **Do** keep list adjacency expressed with a 1px rule line, reserving shadows for cards and modals that float over a whole section.
- **Do** keep this palette and these fonts scoped to `Landing.jsx`, `Login.jsx`, and `src/lib/Ledger*.jsx`/`ledgerTheme.js` — never apply ink blue, Zilla Slab, or Public Sans-as-ledger-body to the dashboard, tender workspace, admin, or analytics screens, which run the separate `App.css` custom-property theme.

### Don't:
- **Don't** reintroduce the dark-graphite-ground/brass-accent palette from the build's first draft — it was explicitly reviewed and replaced; white paper ground and blue ink is the only current palette for this world.
- **Don't** put a live, self-advancing 10-row stage register back on the login page's left panel. That was the shipped and reviewed first iteration but was explicitly replaced with the abstract artwork composition (`LedgerAbstract`); the live register is the landing hero's job only.
- **Don't** reference or recreate `LedgerBoard.jsx` — it no longer exists in the codebase and is not part of the current system.
- **Don't** treat the role list's plain flex-`div` markup in `RoleSection` as a second official row grammar to build on; it is a one-off variance from `LedgerRow`, not a second signature pattern — extend `LedgerRow` itself for new list needs rather than the role list's markup.
