# Motion and animation system

## Product role of motion

Motion is a first-class part of the redesign. It must answer one of three questions: **What changed? Where did the object go? Who acts next?** If an animation cannot answer one of these, remove it. Evidex is an evidence-and-approval product; movement should make the provenance and handoff of a decision understandable, never make an uncertain result feel approved.

The chosen visual direction calls for soft, confident movement, not playful bounce. The system has one memorable orchestration on first page arrival, then restrained state transitions. It does not animate every card on every rerender.

## Motion tokens

Define these centrally in web CSS custom properties and mirror their intent in mobile constants. Do not scatter literal durations across components.

| Token | Duration | Use |
| --- | ---: | --- |
| `instant` | 90 ms | Press acknowledgement, checkbox/icon swap |
| `quick` | 160 ms | Hover lift, selection indicator, tooltip |
| `standard` | 240 ms | Local state replacement, tab content, field highlight |
| `emphasis` | 360 ms | Detail pane enter, claim approval, success message |
| `page` | 520 ms | First page-load orchestration only |
| `stagger` | 55 ms | First four or five page regions; cap last start at 220 ms |

| Easing token | CSS cubic Bézier | Use |
| --- | --- | --- |
| `enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | Decelerating arrival |
| `exit` | `cubic-bezier(0.7, 0, 0.84, 0)` | Fast departure |
| `state` | `cubic-bezier(0.65, 0, 0.35, 1)` | Reversible state change |

Exit motion is about 70–75% of entry duration. Do not use bounce, spring overshoot, elastic, parallax, continuous floating, or animation as a loading disguise. Operational actions should feel faster than navigation.

## Page-load choreography

On the talent status page, after real data resolves:

| Start | Region | Effect |
| ---: | --- | --- |
| 0 ms | Page heading and card-state sentence | Opacity 0→1; translate Y 8→0 px |
| 55 ms | Next-action region | Opacity 0→1; translate Y 10→0 px |
| 110 ms | Match section | Opacity 0→1; translate Y 8→0 px |
| 165 ms | Supporting card/evidence status | Opacity 0→1; translate Y 8→0 px |
| 220 ms | Secondary challenge or help entry | Opacity 0→1; translate Y 6→0 px |

Each region runs for up to 520 ms with the `enter` curve. The shell appears immediately and remains stable. A skeleton occupies approximately the final region sizes while data loads. Run this sequence **once per route entry**, not after every fetch or minor state update. If data are cached and already visible, avoid flashing the page back to opacity zero. Keyboard focus must never wait for the animation.

For organization and operator routes, use the same token cadence but only animate two to three large regions. Do not stagger individual queue rows or table rows; the total time to reach a decision matters more than spectacle.

## Transition matrix

| Event | Visible transition | Async/commit rule | Reduced-motion alternative |
| --- | --- | --- | --- |
| Nav item selection | Active background/text updates in 160 ms; content region arrives once | Route changes immediately | Immediate active state, no translation |
| Open match/claim/queue detail | Detail pane fades and slides 8–12 px from its origin over 360 ms | Preserve list scroll and selection | Instant pane with optional 100 ms fade |
| Switch tabs | Indicator moves or crossfades in 160–240 ms; content crossfades | Keep draft field values | Instant swap, focus preserved |
| Evidence sync starts | Source row shows local busy state; no global dimming | Do not claim verification before server result | Static progress text/spinner without travel |
| Evidence sync completes | Updated source count and state crossfade in 240 ms; changed row may briefly highlight | Reconcile from server response | Immediate update plus live announcement |
| Draft claim approved | Checkbox/button acknowledges in 90 ms; row transitions to approved state in 240–360 ms | Only after successful response; on failure retain row and show error | Immediate state/text change |
| Card published | Success region appears in 360 ms; next-action region changes | Do not imply network publication until API confirms | Static success region and live announcement |
| New match appears | One new row arrives in 240–360 ms, with a clear “new” text marker | Only for real published match data | Immediate row insertion and text marker |
| Need answer submitted | Input enters busy state instantly; live-card changed fields highlight and settle over 240 ms | Preserve answer on failure; do not fill fields early | Highlight without movement, then static state |
| Introduction requested | Button enters pending state; confirmed result becomes “GİRVAK review pending” | Do not expose contact data or imply email sent | Immediate pending/result text |
| Operator queue selection | Selected record remains in place; detail swaps in 240–360 ms | Unsaved edit requires save/discard guard | Immediate detail swap |
| Operator approve/edit/reject | Button acknowledges; record exits in 160–240 ms **after** confirmed commit; next item becomes selected | Never animate as complete before response; error keeps item | Immediate removal and live result |
| Collaboration status update | Timeline connector and text update in 240 ms | Show audit effect only after commit | Immediate status/text update |
| Metrics filter/period change | Existing values hold until new data arrive; numbers crossfade over 240 ms | Never animate counting to a fabricated value | Immediate replacement, denominator retained |

### Why no animated counters

Evidex reports evidence and outcomes with denominators. Counting numerals from zero can make a small or uncertain sample feel more authoritative and can temporarily show false values. Crossfade an old verified value to a new verified value; keep the denominator visible throughout.

## Motion primitives

Only animate `transform` and `opacity` for moving surfaces. Color/background may switch immediately; a short color transition is acceptable for small active indicators, but no layout-affecting transition on width, height, padding, margin, top, or left. For a true disclosure section, use measured content or a `grid-template-rows: 0fr → 1fr` pattern, with content opacity and explicit overflow handling. Do not apply `will-change` to every panel; add it only during active transitions if profiling proves useful.

Avoid page-wide blur, scale-in from tiny size, or slide-in from more than 16 px. Use no infinite animation on a resting dashboard. A loading indicator may pulse while work is genuinely pending, but the text must say what is pending and the animation must stop on resolve/error.

## Interaction details

- Press: up to 2% scale compression for buttons, restored within 90 ms; never make a link jump more than 2 px.
- Focus: focus ring is immediate and persistent. Do not animate its appearance or rely on hover styling.
- Hover: a subtle 1–2 px lift on elevated click targets; list rows use background/indicator changes instead of lift.
- Selected rows: stable position; no sliding the list to emphasize selection.
- Success: position remains stable where possible. Confirmed state text replaces pending text, with `aria-live="polite"`.
- Error: no shake animation. Explain the failure inline, retain input and focus, use `role="alert"`.
- Destructive action: the control visually acknowledges the press, but list removal happens only after server success. Provide undo only when the backend actually supports reversal.

## Reduced motion and accessibility

Web: use `@media (prefers-reduced-motion: reduce)` to disable spatial translations, scale, and stagger. Local opacity transitions may last at most 100 ms, or be removed. The final content and focus state must be identical. Skeleton shimmer should become a static placeholder. Do not disable visible busy indicators, focus rings, success text, or live-region announcements.

Mobile: check `AccessibilityInfo.isReduceMotionEnabled()` on mount and subscribe to changes. Use React Native `Animated` with the native driver for opacity and transform; the current Expo app does not depend on Reanimated, so do not add it solely for basic motion. Use system-native press feedback and keep transitions simple. If reduce motion is enabled, set spatial transition durations to zero and keep state changes explicit. Test VoiceOver and TalkBack announcements independent of animation.

Motion must never trap focus, obscure a pending action, delay the first usable control, or hide a decision behind a decorative transition. On a 390 px viewport, avoid moving large panels horizontally across the full screen; short fades and clear navigation are easier to follow.

## Performance and verification

- Animate no more than five top-level regions on first load. Avoid per-row stagger for large lists.
- Target smooth 60 fps on a mid-range phone and low-end laptop; inspect with browser performance tools. The largest scripted transform should affect a small region, not the whole document.
- Do not set `will-change` persistently. Do not block network requests on animation completion.
- Test slow network, cached data, background-tab return, a failed mutation, rapid route changes, keyboard navigation, and reduced motion.
- Check that no component replays its entrance on ordinary state updates or React Strict Mode remount behavior.
- Capture short video at desktop and 390 px with normal and reduced motion for review. Static screenshots cannot prove this specification is implemented.

## Acceptance demonstrations

1. Talent dashboard loads once: shell appears, heading/task/match/support regions arrive in sequence; no row flicker on data refresh.
2. A claim approval visibly changes from pending to approved after server success, and stays in place with an inline error on failure.
3. An organization answer updates the live card only when accepted; the changed field is briefly traceable.
4. An operator queue record is removed only after successful approval; the next record is selected, and the decision is announced.
5. With reduced motion enabled, all five flows remain fully understandable without spatial movement.
