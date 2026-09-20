# Product UX specification

## Core model

Evidex connects five objects in one loop: talent card, organization, need card, match, and collaboration. The user should always be able to answer: **What state is this in? What evidence supports it? Who decides next?**

Use the source → claim → need → reason → human approval → collaboration → reference chain as the organizing structure. Do not present it as a gamified score or a decorative graph. A diagram is useful only when a user can inspect a real relationship or act on it.

### Role-specific hierarchy

| Role | First visible answer | Secondary answer | Density |
| --- | --- | --- | --- |
| Talent | Is my card in the network, and what should I do now? | Which real matches or challenges need attention? | Comfortable, mobile-first |
| Organization | Is my need clear, and why does this candidate fit or not fit? | What happens after I request an introduction? | Fast scanning, desktop-first |
| Operator | What is waiting for my decision today? | What evidence and outbound text will that decision release? | Dense but readable, desktop-first |

### State language

- Use explicit verbs and owners: “Your card is in the network”; “GİRVAK is reviewing the shortlist”; “Introduction request sent to GİRVAK.”
- Every state should expose the next action or the next actor. Do not use a generic “Processing” state when the responsible party is known.
- Separate `draft`, `approved`, `published`, `introduced`, and `completed` visually and verbally. A draft approval is not the same as an outbound operator approval.
- Dates and sources belong beside claims. Evidence level describes the source relationship, not a ranking of the person.

## App shell and navigation

The selected concept supplies the talent shell: a calm lavender-gray app background, white navigation surface, narrow top bar, and focused main canvas. Desktop talent navigation is a left rail with `Durum`, `Kartım`, and `Meydan okumalar`; introduce `Eşleşmeler` only if it has a real destination, or keep it as a dashboard section. Mobile talent navigation is a persistent bottom bar with at most four items, safe-area padding, a visible active label, and no hidden primary action. The organization shell uses the same materials with fewer sections. The operator shell uses tighter row heights and a wider work area, while preserving the same typography, focus, and color semantics.

Search, notification bells, activity feeds, or profile imagery must not appear as decorative placeholders. Add them only with real behavior and data. The logo always returns to the role's home. Help and logout remain available but visually secondary.

## Core screen specifications

### 1. Public opening page — `apps/web/src/pages/landing.tsx`

Purpose: explain the product and route each role to a relevant entry point. Keep the core proposition and one concrete source-to-reason example. The user explicitly chose an **in-product** visual reference, so the public page must not drive the app shell design. Avoid a long agent inventory in the first viewport. Keep partner and open-source attribution legible below the core explanation.

States: signed-out visitor; signed-in deep link to the correct role. Primary actions must route correctly. Motion is restrained and never delays login.

### 2. Talent status — `apps/web/src/pages/talent-home.tsx`

Purpose: give one clear next action, card state, and real matches. Use the selected image's hierarchy, not its fictional data.

Structure: greeting with card state; prominent next-action region; concise card status and source/approved-claim counts; a match section showing title, qualitative strength, one reason and one gap if those data are available; a challenge entry point when open challenges exist. A count of zero is not a hero metric. Do not add an activity feed until there is a real event source.

Next-action precedence: no source → connect evidence; sources but no approved claims → review claims; approved claims but card draft → approve card; card silent → refresh evidence or join a challenge; pending draft claims → review them; active collaboration requiring response → respond; otherwise relevant open challenge or “card is in the network” reassurance. Validate precedence against current product rules before coding.

The current overview endpoint provides counts, status, matches, challenge count, and last signal date. It does **not** provide the match fit/gap text or a source activity feed. If showing a reason on this screen, extend the endpoint with a minimal, published-match-safe summary. Never use the mockup's organization name before introduction.

States: zero-source onboarding; draft card; approved card with no matches; published match; silent card; returned from approval; API error; loading. On mobile, the next action appears before counts and matches.

### 3. Talent evidence and card — `apps/web/src/pages/talent-card.tsx`

Separate the current long page into four readable zones or tabs: `Sources`, `Review claims`, `Published card`, and `Sharing`. Do not hide a required approval step inside a tab without a status indicator. The source list should summarize each connected GitHub account or repository group first and expand on demand; 58 raw repository rows must not dominate the page. Each claim row shows its text, level, period, source link, and approval state. Put batch actions in a sticky contextual bar only after selection; destructive removal needs explicit scope and recoverable feedback. A published-card preview uses the public view's disclosure rules.

States: no source; sync in progress; sync failed; claim draft; edited draft; approved claim; card draft; card approved; share link enabled/disabled. Do not imply a repo is verified merely because it was imported.

### 4. Organization need conversation — `apps/web/src/pages/needs.tsx`

Use a guided conversation and a live need-card preview. The question is the dominant element; the live card is the persistent reference. Highlight only the fields changed by the latest answer, then settle them. Show what remains before approval in plain language. The organization can edit the generated fields before approving, as noted in the current polish backlog. On narrower screens, switch between conversation and preview using explicit tabs or a sticky `View card` control; preserve typed answers.

States: initial problem entry; question/answer; answer submitting; field updated; required fields missing; ready to approve; approval submitted; API error. A spinner cannot substitute for a visible pending answer.

### 5. Organization candidates — `apps/web/src/pages/candidates.tsx`

Show each candidate as an argument, not a metric card. The first scan line includes first name (until introduction), role/headline, and qualitative strength. Then show `Fits because`, linked supporting claims, `What is missing`, and the introduction action. The reason text has more prominence than the strength label. Preserve the GİRVAK gate: requesting an introduction creates a pending operator action; it does not expose contact information immediately.

States: need not approved; shortlist waiting for GİRVAK; no candidates; candidates available; introduction requested; introduction approved; request failed. Ensure the `name` field remains first-name-only before `introduced`.

### 6. Operator approval queue — `apps/web/src/pages/operator-queue.tsx`

Replace the empty-list-first presentation with a true review workspace when data exist: filterable queue on the left and a selected decision record on the right. Use the existing queue action types (`publish_shortlist`, `introduce`, `send_follow_up`, `invite`) as filters. For each record, show action type, subject, age, proposed consequence, and state. Detail shows exactly what the agent proposes, what evidence or inputs led to it, and the exact outbound text/recipients. Approve, edit, and reject are separate actions. The current API already accepts an edited payload; the current UI lacks the edit control.

Never animate an item away until the server confirms. After success, preserve selection context or choose the next record and announce the result. When empty, explain that no outbound action is waiting; optionally link to recent decisions only if data exist.

### 7. Operator network — `apps/web/src/pages/network.tsx`

Split `Talent`, `Organizations`, and `Discovery / invitations` into clear views within one section. Talent rows show evidence distribution using labels plus compact segments, not color alone; silent state requires an action path. Organization approval belongs beside identity details and verification context. Discovery and bulk invitation controls must expose the target list and outbound copy before queueing.

States: no talent, no organization, refresh in progress/partial failure, approval pending/success/failure, invitation queued. Avoid presenting a successful local queue insertion as an email sent.

### 8. Operator collaborations — `apps/web/src/pages/collaborations.tsx`

Use a compact list with status, last response, next follow-up, and exception state. Opening a row reveals both parties' responses and the timeline. Contradiction and silence are different problems, with different text and actions. A completed collaboration may become a reference only under the approved-organization and recorded-collaboration rule. Make the status transition and its audit effect visible.

States: no collaborations; waiting for first check-in; one-sided response; contradiction; silent party; active; completed; did not happen; scan pending/failure.

### 9. Operator measurement — `apps/web/src/pages/metrics.tsx`

Use a concise summary followed by the underlying denominator and period for every metric. Do not make a large isolated percentage the primary visual. `0/0` is “Not enough data,” never `0%`. A one-case result must say `1/1` prominently. Investigate the current negative time-to-introduction sample before visualizing it; a negative duration is a data or date-order defect, not a design value. Agent-run duration is operational telemetry and should be visually secondary to outcome metrics.

States: insufficient data, small sample, valid aggregate, fetch error. Charts only if they reveal a real trend across a meaningful period.

## Utility and secondary surfaces

| Surface | Required treatment |
| --- | --- |
| Login | Distinct GitHub and email paths; explain who each is for; clear magic-link sent state and recovery path. |
| Public card `/k/:slug` | Read-only evidence dossier; explicit level, period, sources; no private email or GitHub account details outside existing disclosure rules. |
| Check-in `/takip/:token` | Single question, obvious party context, large controls, one-time completion confirmation; expired token state. |
| Talent challenges | Task, due time, deliverable and evidence outcome; clear submitted/closed states. |
| Operator challenges | Draft/open/closed/evaluated states and candidate evidence; no hidden outbound publish action. |
| Organization profile | Name, city, website and verification state, with save/error feedback. |
| Operator needs | Need state, match rerun and challenge/discovery actions, with confirmation of what enters the queue. |

## Talent mobile

The existing Expo app has card and challenge screens, not the full web dashboard. Keep mobile focused: `Card` and `Challenges` are primary; a `Status` view may be added only if it uses the same overview data and has a real next action. The card screen should show pending claims first, then approved card and sources. External GitHub App authorization remains in the system browser. Adapt information density and touch target size; do not compress the desktop panel into 390 px. Preserve state continuity when returning from GitHub.

## Cross-screen states and accessibility

Every data-bearing screen needs a real loading state, meaningful empty state, recoverable error, and success feedback. Async controls disable only the affected action, retain typed input after failure, and explain whether the server committed the change. Decision results use an `aria-live` region; errors use `role="alert"`. Focus moves to the first actionable element after a route change or to a heading after a state transition when the previous control disappears. A drawer or detail pane must close with Escape, return focus to its trigger, and avoid trapping background focus when it is non-modal.

At 390 px, content order follows the role's decision order and no horizontal scrolling is required for primary tasks. At 768 px, side-by-side previews may stack or become tabs. At 1280 px+, organization and operator can use two-pane workspaces. Tables may scroll horizontally only when preserving columns is necessary, with visible scroll affordance and a mobile list alternative for essential information.
