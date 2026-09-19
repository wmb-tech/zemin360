# Evidex

**Evidence-based talent profiles and reasoned matching** for the GİRVAK young-talent network.
Built for the Zemin360 Hackathon 2026 (GİRVAK · İstanbul Development Agency · İstanbul Bilgi
University). Open source, MIT.

> Beyan değil kanıt · skor değil gerekçe · AI yapar, insan onaylar.

## What it does

GİRVAK's six need areas are one loop, and Evidex runs it end to end:

```
discover (01) → verify (02) → define need (05) → match (03) → track (06) → keep alive (04) → …
```

- **Talents** don't describe themselves; they connect evidence (repositories, live products,
  documents, work completed inside the network). An agent drafts a *competence card*; every
  line shows its source, verification level and time span. Nothing enters the network
  unapproved by its owner.
- **Organizations** don't write job ads; they describe a problem. An agent asks questions and
  produces a structured *need card*.
- **Matching** is reasoned, not scored: "fits because this evidence exists; missing this."
- **GİRVAK operators** approve every outbound agent action from one queue, make introductions,
  and track collaboration outcomes, which flow back into cards as references.
- **Challenges** (24–48h tasks derived from real needs) let talents without evidence earn some.
- A **measurement panel** shows what the AI actually contributed.

Product definition (Turkish, canonical): [`docs/01-urun-kimligi.md`](docs/01-urun-kimligi.md).
Decision log: [`docs/02-acik-kararlar.md`](docs/02-acik-kararlar.md).
Architecture decisions: [`docs/adr/`](docs/adr/).

## Stack

Bun · Hono · PostgreSQL + Drizzle · React (Vite) · Expo · Zod. One monorepo, one language.
Why: [ADR-0001](docs/adr/0001-yigin.md). LLM access goes through a provider abstraction
([ADR-0002](docs/adr/0002-llm-saglayici.md)); evidence is stored as signals, never raw content
([ADR-0003](docs/adr/0003-kanit-modeli.md)); agents propose, humans approve
([ADR-0004](docs/adr/0004-ajan-onay-kuyrugu.md)).

```
apps/api         Hono API (Bun)
apps/web         Organization + operator web app (React)
apps/mobile      Talent app (Expo)
packages/shared  Domain schemas and API contract (Zod) — the single source of types
packages/db      Drizzle schema, migrations, seed
packages/ai      LLM provider abstraction and agents
packages/evidence Evidence providers (GitHub, live URL, document, reference, challenge)
```

## Run locally

```bash
cp .env.example .env         # fill what you have; fake LLM provider works without keys
docker compose up -d db      # PostgreSQL 17
bun install
bun run db:migrate
bun run db:seed
bun run dev                  # api :3100, web :5100
```

Everything with one command (handover artefact): `docker compose up`.

## Quality gates

`bun run check` = lint + format + typecheck + tests. CI runs the same on every push.
Conventions: [`docs/03-gelistirme-kurallari.md`](docs/03-gelistirme-kurallari.md).

## Timeline

Online development 18 Sep – 9 Oct 2026 · on-site 9–11 Oct, Kolektif House Levent, İstanbul.

## Team

WMB — İstinye University · Boğaziçi University.

## License

MIT
