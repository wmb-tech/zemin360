# Implementation plan for Claude

This is a handoff plan, not permission to change product rules. Implement the approved redesign in a feature branch such as `feature/evidex-product-redesign`. Work in small reviewable commits with English conventional commit messages. Preserve the existing untracked `.impeccable.md` and `docs/08-tasarim-brief.md`; they are user-owned. Run the repository's checks after each work package and verify the relevant flows in a browser or simulator.

## Baseline and design contract

1. Read `docs/redesign/README.md`, the UX and token specifications, and the motion system. Check `docs/01-urun-kimligi.md`, `docs/02-acik-kararlar.md`, and relevant ADRs before changing any action flow.
2. Capture baseline screenshots at 390, 768, and 1440 px for all nine brief screens, plus login, public card, and check-in. Note which screens need realistic fixture data.
3. Record current `bun run build`, `bun run typecheck`, `bun run lint`, and targeted tests. Do not silently normalize existing failures.
4. Keep a visible comparison against `assets/selected-talent-dashboard.png`. Treat the PNG as a direction for surfaces and hierarchy, not exact data or structure.

## Work package A — foundations and motion (must land first)

**Files:** `apps/web/src/index.css`, `apps/web/index.html` only if font loading changes, `apps/web/src/components/shell.tsx`, new focused components under `apps/web/src/components/`, `apps/mobile/src/lib/theme.ts`, `apps/mobile/src/ui.tsx`.

- Add the semantic tokens from `02-design-system.md` to Tailwind v4 `@theme` and mobile theme. Keep existing token aliases until every screen has migrated.
- Add motion duration/easing tokens and small reusable primitives from `03-motion-system.md`. One page entrance orchestration, a local state transition, and reduced-motion handling must exist before redesigning pages.
- Build role-aware shell behavior: talent navigation can be more spacious; operator navigation and content width need dense workbench mode. Mobile talent navigation must be usable at 390 px. Avoid decorative search and notification controls without backend behavior.
- Implement shared button, field, status badge, evidence-level label, match-strength label, source chip, skeleton, error, and empty-state components only where reuse is real. Do not create an oversized design-system package before usage proves the abstraction.
- Verify AA text contrast, visible keyboard focus, 44 px touch targets, and no horizontal overflow at 390 px.

**Gate:** A small route with real data demonstrates page choreography and reduced motion. Design tokens are used rather than copied literals.

## Work package B — talent web and mobile

**Files:** `apps/web/src/pages/talent-home.tsx`, `apps/web/src/pages/talent-card.tsx`, `apps/web/src/pages/talent-challenges.tsx`, `apps/mobile/src/screens/card.tsx`, `apps/mobile/src/screens/challenges.tsx`, related shared components and narrow API changes.

- Redesign `/durum` first; it is the approved visual anchor. Use the real overview states. Do not show an organization name before introduction, and do not add a fake activity feed.
- Update the next-action precedence and review pending claims. Keep wording truthful for draft, approved, silent, and empty-match states.
- If dashboard match reasons are shown, extend `/api/me/overview` with only the needed published-match fit/gap summary. Source of truth is the stored match reasoning in `matches.reasoning`; validate/cast at the API boundary. Avoid leaking unpublished matches.
- Separate the long card experience into sources, claim review, approved card, and share flow. Preserve all current API actions and clarify batch selection and delete behavior.
- Apply the same tokens and feedback behavior to Expo card/challenge screens. Use built-in React Native `Animated` for opacity/translate transitions; no animation package is needed unless a specific interaction proves otherwise.

**Gate:** Test a new talent with no sources, a card with draft claims, an approved card with no match, a published match, and a silent card on desktop and phone. Demonstrate one server-confirmed claim transition in normal and reduced motion.

## Work package C — organization

**Files:** `apps/web/src/pages/needs.tsx`, `apps/web/src/pages/candidates.tsx`, `apps/web/src/pages/org-settings.tsx`, any narrowly required API handlers.

- Make conversation and live need card a coherent two-pane workspace at desktop and a switchable single-column flow at 390 px. Preserve entered answers during errors and pane switches.
- Expose generated-card edits before approval if the existing API supports them; otherwise make a small explicit API change and verify its authorization.
- Make candidate rationale the primary content: reasons, linked evidence, gaps, and introduction state. Keep candidate surname/identity hidden until the existing introduction gate allows it.
- Show “GİRVAK review pending” after an introduction request; never imply an email was sent immediately.

**Gate:** A nontechnical user can express a need, correct the card, approve it, assess one candidate in about a minute, and understand that GİRVAK must approve the introduction. Test pending, empty, success, and failure states.

## Work package D — operator workbench

**Files:** `apps/web/src/pages/operator-queue.tsx`, `apps/web/src/pages/operator-needs.tsx`, `apps/web/src/pages/network.tsx`, `apps/web/src/pages/collaborations.tsx`, `apps/web/src/pages/operator-challenges.tsx`, `apps/web/src/pages/metrics.tsx`.

- Queue first: implement real selection, filter, detail, approve, edit, reject, and failure recovery. The current decision API already accepts `decision: 'edit'` with `editedPayload`; inspect the action payload schemas before building the editor. Do not send or publish before server-confirmed approval.
- Network: split talent, organization, and discovery/invitations views; keep evidence distribution legible without relying on color alone.
- Collaborations: status timeline and exception handling; distinguish silence from contradiction and make reference eligibility explicit.
- Measurement: denominator and period before decoration. Investigate any negative time-to-introduction calculation and fix it at the source if reproducible. Small samples require explicit `n` context; `0/0` becomes insufficient data.
- Challenges and operator needs inherit shell, tokens, component states, and motion rules. They must not remain visually orphaned after core pages migrate.

**Gate:** An operator can handle four queue action types by keyboard, inspect the exact outbound payload, edit it, approve/reject it, and see a reliable committed state. Simulate server failure: item remains visible. Review a collaboration's follow-up and a metric with a small denominator.

## Work package E — public and utility flows

**Files:** `apps/web/src/pages/landing.tsx`, `login.tsx`, `public-card.tsx`, `checkin.tsx`.

- Keep landing page distinct from the in-product shell while sharing typography/color semantics. User priority is the web product UI; do not let marketing layouts drive the implementation.
- Apply the evidence dossier language to public card with existing disclosure rules. Login and check-in must have complete success, expiry, and error states.
- Check deep links and signed-in redirects after shell changes.

**Gate:** The role entry paths, public share link, and one-time check-in work at desktop and phone widths with natural Turkish copy.

## Work package F — integration and validation

- Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run build`. Use package-local checks while iterating, then full checks once integration is ready.
- Inspect all nine core screens at 390, 768, and 1440 px. Operator 1280+ is primary, but essential actions cannot disappear at smaller widths.
- Verify keyboard order, visible focus, Escape/focus restoration for panes, and `aria-live` or mobile screen-reader announcements for async decisions.
- Record video evidence for the five motion demonstrations in `03-motion-system.md` at normal and reduced motion. Check slow network, cached data, failures, and rapid navigation.
- Compare final screenshots with the selected concept for tone and hierarchy, then audit against the rejected styles: no old spreadsheet feel, no generic blue/purple SaaS decoration, no unreadable dense console.
- Check all copy against API truth, especially privacy before introduction and operator approval gates.

## API and data notes

| Need | Current state | Action |
| --- | --- | --- |
| Talent dashboard rationale | `/api/me/overview` omits fit/gap reasoning | Add a minimal safe field only if the redesigned dashboard displays it. Do not invent a reason in the client. |
| Talent source activity | No activity list in overview | Omit the concept image's activity feed unless a real event source is designed and implemented. |
| Organization need edits | Backlog says approval-time editing is missing | Confirm current route/service contract, then implement explicitly or keep the UX honest about current capability. |
| Operator queue edit | API supports edited payload; UI currently lacks editor | Build per-action editor and verify payload schema. |
| Measurement negative time | Current sample screenshot showed a negative hour value | Trace timestamp order/query before display. Do not mask invalid data with CSS. |

## Review deliverables

For each package, Claude should provide: changed file list, screenshots for affected desktop/mobile states, a short motion capture if motion changed, tests run, and remaining constraints. Keep a change log in the PR or task response. Do not declare the redesign complete until the definition of done in `README.md` and all motion acceptance demonstrations are satisfied.
