# Evidex

**Evidence-based talent profiles and reasoned matching** for the GİRVAK young-talent network.
Built for the Zemin360 Hackathon 2026 (GİRVAK · İstanbul Development Agency · İstanbul Bilgi
University). Open source, MIT.

> Beyan değil kanıt · skor değil gerekçe · AI yapar, insan onaylar.

[![ci](https://github.com/wmb-tech/zemin360/actions/workflows/ci.yml/badge.svg)](https://github.com/wmb-tech/zemin360/actions/workflows/ci.yml)

## What it does

GİRVAK's six need areas are one loop, and Evidex runs it end to end:

```
discover (01) → verify (02) → define need (05) → match (03) → track (06) → keep alive (04) → …
```

- **Talents** don't describe themselves; they connect evidence (GitHub repositories through a
  GitHub App, live products, work completed inside the network). An agent drafts a
  *competence card*; every claim shows its sources, verification level (verified / documented /
  referenced / declared) and time span. Nothing enters the network unapproved by its owner.
  A card can be shared as a public link; it goes quiet after 90 days without new evidence.
- **Organizations** don't write job ads; they describe a problem in plain language. An agent
  asks at most seven questions and produces a structured *need card* the organization approves.
- **Matching** is reasoned, not scored: "fits because this evidence exists; missing this."
  Organizations see first names and reasoning; full cards open only after GİRVAK introduces.
- **GİRVAK operators** approve every outbound agent action from one queue (shortlists,
  introductions, follow-ups, invitations), approve organizations that may give references,
  and watch collaborations: three days after an introduction the agent asks both sides a single
  question through a one-time link; answers, conflicts and silence surface in one screen.
  A completed collaboration becomes a *referenced* claim on the talent's card — only from a
  GİRVAK-approved organization.
- **Challenges** (24–48 h tasks derived from real needs, with a rubric) let talents without
  evidence earn some; submissions are evaluated by an agent and land on the card as verified
  claims. **Scouting** searches public GitHub profiles for a need, an agent picks and justifies,
  invitations go out only after operator approval. Club lists can be invited in bulk.
- A **measurement panel** shows what the AI actually contributed: card accuracy, need clarity,
  time to introduction, top-five conversion, and the fate of every agent proposal.

Product definition (Turkish, canonical): [`docs/01-urun-kimligi.md`](docs/01-urun-kimligi.md) ·
decision log: [`docs/02-acik-kararlar.md`](docs/02-acik-kararlar.md) · backlog:
[`docs/backlog.md`](docs/backlog.md) · architecture decisions: [`docs/adr/`](docs/adr/).

## Agents

Every agent returns a schema-validated result (Zod → JSON schema, ADR-0002) and every run is
recorded in `agent_runs`. No agent talks to a person directly: outbound actions wait in the
operator's approval queue (ADR-0004).

| Agent                  | Loop step | Input → output                                              | Human gate                        |
| ---------------------- | --------- | ----------------------------------------------------------- | --------------------------------- |
| `card_drafter`         | 02        | evidence signals → claims with sources, headline, story     | talent approves each claim        |
| `need_structurer`      | 05        | raw text + answers → need card, next question               | organization approves the card    |
| `matcher`              | 03        | need card + candidate cards → reasoned, ranked list         | operator publishes the shortlist  |
| `introducer`           | 03        | need + reasoning → introduction e-mail draft                | operator edits/approves           |
| `follow_up`            | 06        | collaboration context → one question per side              | operator approves sending         |
| `checkin_interpreter`  | 06        | free-text answer → summary, flags, reference claim          | operator reads flagged ones only  |
| `challenge_designer`   | 01        | need card → 24/48 h task + rubric                           | operator opens the challenge      |
| `submission_evaluator` | 01        | task + repo signals → rubric scores, band, card claim       | ranking is shown; talent approves |
| `scout`                | 01        | need card + public GitHub profiles → picks with reasons     | operator approves invitations     |

Fake provider (`LLM_PROVIDER=fake`) walks the whole loop without keys; tests use it. Default
real provider is Gemini 2.5 Pro on Vertex AI; Anthropic is supported.

## Stack

Bun · Hono · PostgreSQL + Drizzle · React (Vite, Tailwind v4) · Expo · Zod. One monorepo, one
language. Why: [ADR-0001](docs/adr/0001-yigin.md). Evidence is stored as signals, never raw
content ([ADR-0003](docs/adr/0003-kanit-modeli.md)); GitHub access goes through a GitHub App
with repository selection by the talent ([ADR-0005](docs/adr/0005-octokit.md)); follow-ups
use one-time hashed tokens ([ADR-0006](docs/adr/0006-takip-ve-referans.md)); scouting uses
public data only and never stores profiles ([ADR-0007](docs/adr/0007-kesif-ajani.md)).

```
apps/api           Hono API (Bun) — auth, needs, matching, operator queue, follow-ups,
                   challenges, scouting, network, metrics; hourly scheduler
apps/web           Talent + organization + operator web app (React)
apps/mobile        Talent app (Expo) — in progress
packages/shared    Domain schemas, thresholds and API envelope (Zod) — single source of types
packages/db        Drizzle schema, migrations, seed
packages/ai        LLM provider abstraction (Google/Vertex, Anthropic, fake) and agents
packages/evidence  Evidence providers: GitHub App, live URL (SSRF-guarded), public repo, scout
```

### Roles and screens

| Role         | Screens                                                                               |
| ------------ | ------------------------------------------------------------------------------------- |
| Talent       | `/kanit` evidence & card (GitHub App, live URL, claims, share link) · `/davetler` challenges |
| Organization | `/ihtiyaclar` needs (agent conversation, live card preview, approval) · candidates · results |
| Operator     | `/kuyruk` approval queue · `/ag` network (silent cards, org approval, scouting, invites) · `/meydan` challenges · `/isbirlikleri` collaborations · `/olcum` metrics |
| Public       | `/k/:slug` shared card · `/takip/:token` follow-up answer                             |

## Run locally

```bash
cp .env.example .env         # fill what you have; LLM_PROVIDER=fake works without keys
docker compose up -d db      # PostgreSQL 17 on :5433 (or use your own on :5432)
bun install
bun run db:migrate
bun run db:seed              # operator@evidex.dev · kurum@evidex.dev · ayse@evidex.dev · mehmet@evidex.dev
bun run dev                  # api :3100, web :5100
```

Without SMTP the magic-link e-mail is printed to the API console. GitHub sign-in and the
GitHub App need `GITHUB_*`; scouting and public-repo reading need `GITHUB_SERVER_TOKEN`.

## Quality gates

`bun run check` = lint + format + typecheck + tests (36 tests: API end-to-end on a real
Postgres, agents, evidence providers). Husky runs it before every commit; CI runs it on
every push with a Postgres service. Conventions:
[`docs/03-gelistirme-kurallari.md`](docs/03-gelistirme-kurallari.md).

## Timeline

Online development 18 Sep – 9 Oct 2026 · on-site 9–11 Oct, Kolektif House Levent, İstanbul.

## Team

WMB — İstinye University · Boğaziçi University.

## License

MIT
