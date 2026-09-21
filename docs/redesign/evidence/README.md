# Redesign evidence — work package F

Captured on the `feature/evidex-product-redesign` branch against the local stack (API :3100, web :5100, seeded database plus one real GitHub-synced talent). All screenshots are real API states; nothing is mocked in the client.

## Screens × widths

| Screen | phone 390 | tablet 768 | desktop 1440 |
| --- | --- | --- | --- |
| Talent status `/durum` | `talent-durum-phone.png` | `talent-durum-tablet.png` | `talent-durum-desktop.png` |
| Talent card `/kart?bolum=iddialar` | `talent-kart-phone.png` | `talent-kart-tablet.png` | `talent-kart-desktop.png` |
| Organization needs `/ihtiyaclar` | `org-ihtiyac-phone.png` | `org-ihtiyac-tablet.png` | `org-ihtiyac-desktop.png` |
| Organization candidates `/ihtiyaclar/:id/adaylar` | `org-adaylar-phone.png` | `org-adaylar-tablet.png` | `org-adaylar-desktop.png` |
| Operator queue `/kuyruk` | `operator-kuyruk-phone.png` | `operator-kuyruk-tablet.png` | `operator-kuyruk-desktop.png` |
| Operator network `/ag` | `operator-ag-phone.png` | `operator-ag-tablet.png` | `operator-ag-desktop.png` |
| Operator collaborations `/isbirlikleri` | `operator-isbirlikleri-phone.png` | `operator-isbirlikleri-tablet.png` | `operator-isbirlikleri-desktop.png` |
| Operator measurement `/olcum` | `operator-olcum-phone.png` | `operator-olcum-tablet.png` | `operator-olcum-desktop.png` |
| Landing `/` | `public-acilis-phone.png` | `public-acilis-tablet.png` | `public-acilis-desktop.png` |
| Login `/giris` | `public-giris-phone.png` | `public-giris-tablet.png` | `public-giris-desktop.png` |
| Public card `/k/:slug` | `public-kart-public-phone.png` | `public-kart-public-tablet.png` | `public-kart-public-desktop.png` |

Operator queue desktop was captured empty (no pending proposal at that moment); the populated state is visible in `motion/4-queue-approve-next-*.webm`.

## Motion demonstrations (`03-motion-system.md` §Acceptance)

Each flow recorded twice: `-normal.webm` (system default) and `-reduced.webm` (`prefers-reduced-motion: reduce`, emulated by the browser context).

1. `1-talent-dashboard-enter` — shell, then heading / next action / card+matches / aside arrive in sequence (55 ms stagger); reload shows the same once-only entry; a data refresh does not replay it.
2. `2-claim-approve-settle` — "Onayla" goes to pending state, server answers, row highlights and moves from "Gözden geçir" to "Onaylı"; counts update from the server response.
3. `3-org-answer-card-update` — organization answers the agent's question; the live card on the right changes only after the API accepts the answer and the changed fields settle-highlight.
4. `4-queue-approve-next` — operator selects the proposal, presses `A`; the record leaves the list only after the server confirms, the next record is selected and the decision is announced via `aria-live`.
5. Reduced motion is the `-reduced` variant of each: fades of ≤100 ms, no translate, no settle animation; every state remains readable.

## Checks run

- `bun run check` (lint, format:check, typecheck for all workspaces, unit tests: evidence 8, ai 8, api 26 — all green)
- `bun run build` (web bundle 498 kB / 148 kB gzip)
- Browser: Chrome (Playwright), locale tr-TR, widths 390 / 768 / 1440

## Known constraints

- Local seed predates the "claims link to sources" fix, so seeded claims show "kaynak yok"; real synced talents show source counts (verified on production data before the redesign).
- Tablet (768) uses the desktop shell with a 232 px sidebar; the operator workbench is usable but dense there, as accepted in the plan (operator primary is 1280+).
- Mobile app screens were not captured on a simulator in this pass; tokens/motion are shared through `apps/mobile/src/lib/{theme,motion}.ts` and typecheck is green.
