# Evidex product redesign handoff

**Status:** Approved visual direction; implementation pending.  
**Audience:** Claude or another implementation agent working in this repository.  
**Scope:** Web product interfaces for talent, organizations, and GİRVAK operators, plus the talent mobile app. The public landing page is a lower-priority surface and is not the reference for the product UI.

## Start here

1. Read this file and the five companion documents in order.
2. Inspect the current page and API before changing it. Product rules in `docs/01-urun-kimligi.md`, `docs/02-acik-kararlar.md`, and the ADRs remain authoritative.
3. Use [the selected talent dashboard image](assets/selected-talent-dashboard.png) as a **visual direction**, not as a literal layout or data contract. It is an AI-generated concept and contains invented activity, a possible nested-card structure, and an organization name that the live API correctly hides before introduction.
4. Implement the motion system alongside the first screen. Motion is a primary acceptance criterion, not a final polish pass.

## Design decision

The user selected the light, polished, softly rounded dashboard direction after rejecting three earlier operator-panel concepts. The rejected concepts felt like an old spreadsheet, generic AI SaaS, or an unreadable operations console. Keep the selected image's calm lavender-gray canvas, precise purple accent, confident type, clear navigation, and generous hierarchy. Improve its information architecture and replace all invented content with real domain data.

The user also provided four visual references: an airy education dashboard with disciplined rounded modules, a soft sculptural interface illustration, a spatial data workspace, and a pastel learning dashboard. These are inspiration for finish, depth, and spatial clarity. The selected **Evidex** talent-dashboard image is the approved direction; do not copy course content, charts, a device mockup, or a spatial graph into the product merely because they appeared in the references.

The desired product feels finished and used daily by young people and institutions. It must still work for a small GİRVAK team scanning dense operational data. Do not make every role look like the talent dashboard: share tokens and interaction rules, then tune density by role.

## Source of truth and constraints

- Product rules: `docs/01-urun-kimligi.md`, `docs/02-acik-kararlar.md`, `docs/adr/`.
- Current implementation: `apps/web/src`, `apps/mobile/src`, API and shared package contracts.
- Context-only visual brief: `docs/08-tasarim-brief.md` and screenshots in `/Users/alper/Desktop/evidex-brief/`.
- Existing `.impeccable.md` is user-owned context. Do not overwrite it.
- Code, identifiers, commit messages, and documentation stay in English. User-visible product copy stays natural Turkish.
- Do not invent backend data, fake activity, counts, evidence links, or reasons. If a design requires unavailable data, document the API change explicitly.
- Before introduction, the organization name is hidden from the talent (`apps/api/src/talent/service.ts`); before introduction, the organization sees only the talent's first name (`apps/api/src/matching/service.ts`). Preserve both directions of this privacy rule.
- An agent never sends a message or publishes a shortlist before the operator approves the queued action.
- Match strength is qualitative: strong, possible, or weak. Do not show a numerical match score.

## Companion documents

| File | Purpose |
| --- | --- |
| [01-product-ux.md](01-product-ux.md) | Information architecture, role journeys, screen-by-screen behavior, responsive rules, content and state handling |
| [02-design-system.md](02-design-system.md) | Color, typography, spacing, surfaces, component contracts, accessibility |
| [03-motion-system.md](03-motion-system.md) | Motion principles, tokens, choreography, transition matrix, reduced-motion behavior, performance and QA |
| [04-implementation-plan.md](04-implementation-plan.md) | Ordered work packages, file map, API gaps, verification and completion gates |
| [05-claude-brief.md](05-claude-brief.md) | Copy-ready assignment for the implementation agent |

## Definition of done

The redesign is complete only when all nine core screens in the brief, the linked utility flows, and talent mobile surfaces use the same system; each async and decision state is designed; the key transition choreography works; keyboard and reduced-motion paths are verified; and real API states remain truthful. A static screenshot match is insufficient.
