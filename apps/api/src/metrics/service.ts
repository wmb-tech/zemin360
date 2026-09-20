import { sql } from 'drizzle-orm';
import type { Db } from '@evidex/db';

/**
 * ### Ölçüm paneli — "AI süs değil" kanıtı (ürün kimliği §5)
 * Beş metrik, hepsi mevcut tablolardan türetilir; ayrı sayaç tutulmaz (sayaç sapar, tablo
 * sapmaz). Her metrik yanında paydası döner: "0/0" ile "0/40" aynı şey değildir.
 */
export function createMetricsService(db: Db) {
  return {
    async summary() {
      // 1. Kart doğruluğu: onaylı iddialardan kaçı ajanın yazdığı metinle birebir onaylandı
      const [kart] = (
        await db.execute(sql`
          select count(*)::int as total,
                 count(*) filter (where text = draft_text)::int as unchanged
          from card_claims where approved = true and draft_text is not null`)
      ).rows as { total: number; unchanged: number }[];

      // 2. İhtiyaç netliği: ilk taslakta eksik alan sayısı (ajan ilk turu) ve onaya kadar soru sayısı
      const [netlik] = (
        await db.execute(sql`
          select count(*)::int as approved_needs,
                 avg(jsonb_array_length(turns))::float as avg_turns
          from needs where card_status = 'approved'`)
      ).rows as { approved_needs: number; avg_turns: number | null }[];
      const [ilkTur] = (
        await db.execute(sql`
          select avg(jsonb_array_length(output_summary->'missing'))::float as avg_initial_missing
          from agent_runs where agent = 'need_structurer' and (input_summary->>'turnCount')::int = 0`)
      ).rows as { avg_initial_missing: number | null }[];

      // 3. İhtiyaçtan ilk tanıştırmaya süre (saat)
      const [sure] = (
        await db.execute(sql`
          select count(*)::int as needs_with_intro,
                 avg(extract(epoch from (m.first_intro - n.card_approved_at)) / 3600)::float as avg_hours
          from needs n
          join (select need_id, min(introduced_at) as first_intro from matches where introduced_at is not null group by need_id) m
            on m.need_id = n.id
          where n.card_approved_at is not null`)
      ).rows as { needs_with_intro: number; avg_hours: number | null }[];

      // 4. İlk beşten görüşmeye dönüş
      const [donus] = (
        await db.execute(sql`
          select count(*)::int as top5_introduced,
                 count(*) filter (where c.status in ('meeting','started','ongoing','completed'))::int as reached_meeting
          from matches m
          left join collaborations c on c.match_id = m.id
          where m.rank <= 5 and m.introduced_at is not null`)
      ).rows as { top5_introduced: number; reached_meeting: number }[];

      // 5. Ajan önerilerinin akıbeti
      const kuyruk = (
        await db.execute(sql`select status, count(*)::int as n from approval_queue group by status`)
      ).rows as { status: string; n: number }[];
      const q = Object.fromEntries(kuyruk.map((k) => [k.status, k.n])) as Record<string, number>;

      const ajanlar = (
        await db.execute(
          sql`select agent, count(*)::int as runs, avg(duration_ms)::float as avg_ms from agent_runs group by agent`,
        )
      ).rows as { agent: string; runs: number; avg_ms: number | null }[];

      return {
        cardAccuracy: { approvedClaims: kart?.total ?? 0, unchangedClaims: kart?.unchanged ?? 0 },
        needClarity: {
          approvedNeeds: netlik?.approved_needs ?? 0,
          avgQuestionsToApproval: netlik?.avg_turns ?? null,
          avgInitialMissingFields: ilkTur?.avg_initial_missing ?? null,
        },
        timeToIntroduction: {
          needsWithIntroduction: sure?.needs_with_intro ?? 0,
          avgHours: sure?.avg_hours ?? null,
        },
        topFiveConversion: {
          introduced: donus?.top5_introduced ?? 0,
          reachedMeeting: donus?.reached_meeting ?? 0,
        },
        agentProposals: {
          proposed: q.proposed ?? 0,
          approved: q.approved ?? 0,
          edited: q.edited ?? 0,
          rejected: q.rejected ?? 0,
        },
        agentRuns: ajanlar,
      };
    },
  };
}
