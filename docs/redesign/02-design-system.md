# Design system specification

## Visual premise

The selected direction is a **polished product workspace**: cool, lightly tinted canvas; near-white working surfaces; confident dark text; one controlled violet accent; soft geometry; enough whitespace to establish hierarchy. The product identity comes from the legible source-to-claim-to-reason structure, not illustration, metric cards, or a purple wash over every element.

The selected PNG is a concept, not a pixel target. In particular, flatten nested panels, remove fake activity and unsupported navigation, and keep content density suitable for each role.

## Color tokens

Use semantic names in `apps/web/src/index.css` `@theme`, with OKLCH values. `apps/mobile/src/lib/theme.ts` holds corresponding sRGB hex values. The hex column is the cross-platform reference. The OKLCH values are rounded conversions and should be visually checked after implementation.

| Token | Web OKLCH | Mobile/reference hex | Use |
| --- | --- | --- | --- |
| `ink` | `oklch(0.272 0.045 274)` | `#20253D` | Primary text |
| `ink-soft` | `oklch(0.499 0.034 273)` | `#5C6277` | Secondary text |
| `paper` | `oklch(0.978 0.011 281)` | `#F6F7FF` | App canvas |
| `surface` | `oklch(0.998 0.002 280)` | `#FEFEFF` | Work surfaces |
| `paper-2` | `oklch(0.958 0.020 280)` | `#EEF0FF` | Quiet selected/feature surface |
| `line` | `oklch(0.912 0.021 277)` | `#DEE1F0` | Dividers and borders |
| `accent` | `oklch(0.503 0.214 278)` | `#5147D9` | Primary action and navigation |
| `accent-strong` | `oklch(0.428 0.197 277)` | `#3D34B7` | Hover, pressed, selected text |
| `accent-soft` | `oklch(0.958 0.020 280)` | `#EEF0FF` | Selected nav and action context |
| `verified` | `oklch(0.515 0.106 163)` | `#147A55` | Verified evidence text/mark |
| `verified-soft` | `oklch(0.969 0.015 165)` | `#ECF8F2` | Verified background |
| `documented` | `oklch(0.497 0.113 248)` | `#23669F` | Documented evidence text/mark |
| `documented-soft` | `oklch(0.966 0.013 244)` | `#EDF5FC` | Documented background |
| `referenced` | `oklch(0.549 0.122 58)` | `#A55C17` | Reference evidence text/mark |
| `referenced-soft` | `oklch(0.968 0.020 77)` | `#FCF3E6` | Reference background |
| `declared` | `oklch(0.521 0.027 267)` | `#626979` | Declared evidence text/mark |
| `declared-soft` | `oklch(0.967 0.004 271)` | `#F3F4F7` | Declared background |
| `negative` | `oklch(0.544 0.150 13)` | `#B64256` | Error and destructive text |
| `negative-soft` | `oklch(0.970 0.015 8)` | `#FFF1F3` | Error background |

Strength indicators are separate components with explicit text. Strong uses verified green; possible uses accent violet; weak uses slate. Do not infer a numeric rank from color saturation or add a percentage. Evidence level and match strength always include their labels, and evidence level should have a distinct icon or short descriptor when space permits. The source type (GitHub, live product, PDF, network reference, challenge submission) is **not** the evidence level.

The listed text/background pairs were checked for at least 4.5:1 contrast as reference hex values. Claude must recheck actual rendered CSS and hover/focus/disabled states. Avoid opacity-reduced body copy that falls below AA.

## Typography

Use Manrope, already loaded in `apps/web/index.html`, as the primary family. It matches the selected direction and avoids an unnecessary font migration. Do not introduce Inter, Roboto, Arial, or a second display font for the app. Use tabular numerals only for dates, counts, and measurements.

| Role | Desktop size / line height | Mobile adjustment | Weight |
| --- | --- | --- | --- |
| `caption` | 12 / 18 | Same | 600 |
| `meta` | 14 / 20 | Same | 500–700 |
| `body` | 16 / 24 | Same | 400–600 |
| `section` | 22 / 29 | 20 / 27 | 700 |
| `page` | 34 / 42 | 28 / 36 | 800 |

Use letter spacing sparingly: page title `-0.035em`, section title `-0.02em`; body and data labels default. Uppercase only short eyebrow labels, never long instructions. Long claim and rationale text remains 16 px with a measure around 65–75 characters. Operator rows may use 14 px text, but decision text should stay at 16 px.

## Spacing and layout

Base unit: 4 px. Named steps: 4, 8, 12, 16, 24, 32, 48, 64 px. Space within one information group is 8–12 px; between groups 24–32 px; between major screen regions 40–48 px. Do not use the same gap everywhere. Selected concept's large task region gets room; operator records are denser.

| Surface | Desktop | Tablet | Phone |
| --- | --- | --- | --- |
| Talent sidebar | 224–240 px fixed/sticky | 72 px rail or top navigation | Bottom navigation |
| Main content | Fluid, max 1440 px | Fluid | 16 px horizontal gutter |
| Talent content | Main 2/3 + support 1/3 where useful | Single column or 60/40 | Single column, next action first |
| Organization workbench | Conversation 55% + live card 45% | Tabs/stack | Explicit switch, preserve draft |
| Operator workbench | Queue 38–44% + detail remainder | Queue/detail route or drawer | Read-only/limited tasks if necessary; no critical hidden action |

Controls have at least 44×44 px hit area on touch. The top app bar is 64 px; mobile bottom navigation must respect safe area. Lists should use alignment, dividers, and content rhythm before adding containers.

## Shape, border, and elevation

- `radius-control`: 10–12 px for fields/buttons.
- `radius-panel`: 16–18 px for a single content surface.
- `radius-feature`: 22–24 px for the one prominent next-action area.
- Lines: 1 px tinted lavender-gray. A selected record may use a subtle 2 px inner indicator, never a thick one-sided colored border.
- Shadows: none on most in-flow content. A soft one-step shadow is allowed for the app shell or elevated decision pane; stronger shadow only for a temporary popover. Do not make every card float.
- No glass blur, neon glow, gradient text, decorative sparklines, or repeated icon-heading-description cards.

## Component contracts

### Navigation and app shell

Role-aware sidebar/top bar/mobile navigation. Active item has background **and** text/icon change, not color alone. No fake search box or notification icon. Logo returns to role home. Scroll position resets on route change only when appropriate; detail panes preserve list position.

### Buttons and links

`primary` is reserved for the one main action in a decision context. `secondary` is bordered neutral. `tertiary` is text/icon. `danger` is for irreversible destructive action. Each has default, hover, focus, pressed, pending, disabled states. Pending keeps button width stable, exposes progress text, and prevents duplicate requests. Do not make every row action primary.

### Fields

Visible persistent label, optional hint, input, error under the control. Error includes how to recover and preserves entered text. Read-only generated text is visibly different from editable fields. For the need conversation, “answer” input remains anchored near the latest question.

### Evidence claim row

Required order: statement → evidence level + period → source(s) → approval state/actions. A source chip uses a source-kind label and readable shortened identifier; full reference is available via link/title. The claim's entire border must not encode its evidence level. A draft claim is actionable; an approved claim is stable. Selection controls appear only when there is a batch action.

### Match reasoning block

Order: role/need title → strength label → 1–2 sentence summary → `Fits because` evidence-linked reasons → `What is missing` → introduction state/action. If no gaps exist, say “No material gap was identified”; do not show a dash. Make the rationale legible in one minute for the organization.

### Queue record and decision pane

Queue row: action type, subject, waiting time, one-sentence consequence, status. Selected state is clear but does not turn the entire row violet. Decision pane: agent proposal, supporting inputs, exact outbound payload, and approve/edit/reject actions. Editing is an explicit mode with save/discard; reviewing another item preserves or warns about unsaved edits.

### Status and feedback

Empty state explains what will appear and the next relevant action. Skeleton mirrors final layout and uses no infinite shimmer. Inline success should name the completed action and the next actor. Errors are close to the failed control. Toasts are optional for noncritical success but never the sole record of a committed decision.

### Tables and lists

Operator tables use 44–52 px rows, sticky header when scrolling, aligned date/status columns, and visible sorting. Dense rows are for scanning; details open in a persistent pane. On phone, use a purposeful list layout, not a squeezed table.

## Content and icon rules

Product copy is Turkish, direct, and specific. Prefer “Kartın ağda” to “Profiliniz başarıyla yayına alınmıştır.” Avoid invented progress percentages, decorative charts, and vague prompts to “strengthen your profile.” Icons have one stroke family and only clarify recurring actions or sources. Never rely on icons without labels for high-consequence actions.
