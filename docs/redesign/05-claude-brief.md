# Claude implementation brief

Implement the complete Evidex product redesign described in `docs/redesign/README.md` and companion files `01-product-ux.md` through `04-implementation-plan.md`. The user approved `docs/redesign/assets/selected-talent-dashboard.png` as the visual direction for the in-product young-person dashboard and explicitly emphasized that the motion/animation system is one of the most important requirements.

Work in the existing `/Users/alper/code/zemin360` repository. Start by reading the product identity, decision ledger, relevant ADRs, existing screens, API contracts, and current untracked user files. Preserve user changes. Use an English conventional-commit feature branch. Apply the redesign across all nine core web screens, utility routes, and talent mobile surfaces, with reviewable work packages and real states. Do not stop after recreating one screenshot.

Key rules:

1. Build shared design tokens and motion primitives before page-specific polish. The selected image is a mood/hierarchy reference, not a source of fake activity or permission to reveal private identities.
2. Make motion explain state, provenance, and human handoff. Implement the first-load choreography and the five state-transition demonstrations in `03-motion-system.md`; support reduced motion on web and Expo.
3. Keep all existing product gates: no numeric match score; talent and organization identity disclosure only after introduction; no outbound agent action before operator approval; references only from eligible recorded collaborations.
4. Use real API data. If an interface needs data the API does not expose, make a narrow, authorized API change or omit that affordance. Never fill the dashboard with invented sources, match reasons, activity, or counts.
5. Keep user-visible text natural Turkish; keep code, comments, documentation, and commit messages English. TypeScript stays strict. Preserve keyboard access, AA contrast, error recovery, and responsive behavior at 390, 768, and 1280+ px.
6. Validate each work package in the browser/simulator, run repository checks, and include screenshots plus motion recordings. Do not claim completion until the definition of done in the handoff README and the acceptance gates in the implementation plan pass.

Start with work package A and the approved `/durum` screen, then continue through the remaining packages. Report any product-rule conflict with a specific source and a proposed resolution before changing the rule.
