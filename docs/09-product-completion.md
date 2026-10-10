# Product completion — 10 October 2026

This update completes the agreed web product gaps alongside the visual polish. It is implemented locally; deployment and production migrations have not been performed.

## Talent preferences and matching

Talent accounts can declare availability, collaboration types, work modes, maximum project duration, and weekly hours in Account. Unavailable accounts and known incompatible preferences are excluded before model inference. Empty selections remain permissive. Unknown duration and limited weekly capacity are explicit discussion gaps, not invented compatibility scores. Preference changes affect new matching runs and do not cancel existing introductions or collaborations.

Matching only accepts supporting claim IDs belonging to the candidate. Refreshes retain ongoing introductions and collaborations, close obsolete unpublished proposals, and keep already published candidates accessible while a refreshed shortlist awaits review.

## Email signup and evidence meaning

Email signup supports talent and organization accounts without GitHub. Existing accounts retain their role, and the public request cannot create an operator. Token consumption and initial account creation are transactional. GitHub remains an optional entry and evidence source.

The evidence guide distinguishes ownership verification from independent validation of every skill or claim. URL ownership does not prove that every claim is true; uploaded PDFs do not automatically authenticate the issuer; network references do not constitute a skills examination.

## Mutual introduction consent

The new Introductions page shows scoped project terms without the other party's full identity or email. Both parties must accept before operator approval. An organization request records that organization's acceptance, whereas operator-initiated requests ask both parties. A participant can withdraw before operator approval; this closes the proposed request. Ownership checks and queue/match locks protect consent decisions and approval against concurrent requests.

The approved introduction and its email payload are committed together in a durable delivery record. Email is sent only after commit. Concurrent workers claim a pending record atomically. Successful sending records sentAt and queue execution. SMTP interruptions become uncertain and never retry automatically: an interrupted send may already have reached the recipient. The operator sees every unresolved delivery plus the latest 100 completed deliveries. Explicit retries require checking the recipient first and produce an audit entry. Stale sending records become uncertain after ten minutes. The existing scheduler drains pending deliveries; with scheduling disabled, approval still attempts its initial send.

SMTP success confirms server acceptance, not inbox delivery or message reading. Exactly-once delivery cannot be guaranteed after an ambiguous SMTP response.

## Metrics

- Card draft acceptance measures unchanged approved draft text, not factual accuracy.
- Shortlist entries persist the first published rank per need/talent pair, including candidates whose unintroduced match is later replaced. The top-five denominator no longer shrinks when matching refreshes.
- Introduction count and elapsed time use confirmed delivery sentAt. Pending and uncertain records are excluded. Historical introductions without a delivery record retain introducedAt as their legacy fallback.
- Meeting conversion uses the same confirmed-introduction eligibility.
- Proposal decisions count operator decisions rather than participant withdrawals or automated shortlist replacement.
- Model names are derived from recorded agent runs. Demo data is included when loaded and is explicitly disclosed in the interface.

## Database changes

Apply migrations 0016_product_completion and 0017_durable_introductions before starting the updated API. They add signup roles, preferences, consent state, published-match timestamps, durable shortlist history, and delivery records. Existing proposed introduction requests are backfilled with pending consent; only organization-originated requests get organization acceptance. Existing historical introductions are not assigned fabricated consent. Shortlist history can be backfilled from surviving published matches, but previously deleted matches cannot be reconstructed.

## Validation and scope

Full repository checks pass: lint, formatting, workspace type checks, AI/evidence tests, and 53 API tests. New regression coverage includes role preservation, preference filtering, claim ownership, mutual consent, withdrawal, authorization, concurrent approval, rollback without sending, ambiguous SMTP retries, shortlist refresh history, and confirmed-delivery metrics. The production web build passes. Local browser checks cover the new web preferences, consent, operator approval, delivery screens, and email signup at desktop and 390 px widths.

The native Expo client was not updated with these new screens. This validation uses fake external providers and an isolated local database; production email, GitHub, and live model integrations still require environment-specific verification.
