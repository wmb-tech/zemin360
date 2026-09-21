import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking as RNLinking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { THRESHOLDS, type EvidenceLevel, type EvidenceSourceKind } from '@evidex/shared';
import { API_ORIGIN, api, tokenStore } from '../lib/api';
import { useAuth } from '../lib/auth';
import { c, LEVEL } from '../lib/theme';
import { Enter } from '../lib/motion';
import { Badge, Button, Card, H1, Label, Soft } from '../ui';

interface Claim {
  id: string;
  text: string;
  level: EvidenceLevel;
  sourceIds: string[];
  periodStart: string | null;
  periodEnd: string | null;
  approved: boolean;
}
interface Source {
  id: string;
  kind: EvidenceSourceKind;
  ref: string;
  ownershipVerified: boolean;
}
interface CardData {
  talent: {
    headline: string | null;
    story: string | null;
    cardStatus: 'draft' | 'approved';
    githubConnected: boolean;
    lastSignalAt: string | null;
    silent: boolean;
    publicSlug: string | null;
  };
  user: { name: string; githubLogin: string | null };
  sources: Source[];
  claims: Claim[];
}

const KIND: Record<EvidenceSourceKind, string> = {
  github_repo: 'GitHub',
  live_url: 'Canlı',
  document: 'Belge',
  network_reference: 'Referans',
  challenge_submission: 'Meydan okuma',
};
const ay = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }) : null;

/**
 * Gencin kartı (doğrula 02, canlı tut 04): kaynaklar, iddialar (onayla/sil), kart onayı,
 * paylaşım. GitHub App kurulumu ve canlı URL doğrulama web'de daha rahat; buradan sistem
 * tarayıcısıyla açılır. Ürün kuralı aynı: onaysız iddia ağa girmez.
 */
export function CardScreen() {
  const { me, logout } = useAuth();
  const [card, setCard] = useState<CardData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setCard(await api<CardData>('/api/me/card'));
    } catch (e) {
      Alert.alert('Kart yüklenemedi', e instanceof Error ? e.message : 'Hata');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      Alert.alert('Olmadı', e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(null);
    }
  }

  /**
   * GitHub App kurulumu sistem tarayıcısında koşar (repo seçimi GitHub'ın ekranı). Dönüş
   * `evidex://auth?token=…&installed=1` derin linki; token yenilenir, kart yeniden okunur.
   */
  async function installGithub() {
    const r = await WebBrowser.openAuthSessionAsync(
      `${API_ORIGIN}/api/auth/github/install?client=mobile`,
      Linking.createURL('auth'),
    );
    if (r.type === 'success') {
      const token = new URL(r.url).searchParams.get('token');
      if (token) await tokenStore.set(token);
    }
    await load();
  }

  if (!card) return null;
  const onayli = card.claims.filter((x) => x.approved).length;
  const approved = card.talent.cardStatus === 'approved';

  return (
    <ScrollView
      style={{ backgroundColor: c.paper }}
      contentContainerStyle={s.wrap}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
        />
      }
    >
      <Enter i={0}>
        <View style={s.top}>
          <View style={{ flex: 1 }}>
            <H1>{card.user.name}</H1>
            <Soft>
              {card.talent.headline ?? 'Başlık henüz yok'}
              {card.user.githubLogin ? ` · @${card.user.githubLogin}` : ''}
            </Soft>
          </View>
          <Pressable onPress={() => void logout()}>
            <Text style={{ color: c.inkSoft, textDecorationLine: 'underline' }}>Çıkış</Text>
          </Pressable>
        </View>

        <View style={s.status}>
          <Badge
            text={approved ? 'Kart onaylı · ağda' : 'Taslak'}
            color={approved ? c.verified : c.declared}
            bg={approved ? c.verifiedSoft : c.declaredSoft}
          />
          {card.talent.silent && (
            <Text style={s.silent}>
              Sessiz: {THRESHOLDS.silentCardAfterDays} günden uzun süredir yeni etkinlik yok.
            </Text>
          )}
        </View>

        {card.talent.story && <Text style={s.story}>{card.talent.story}</Text>}
      </Enter>

      <Enter i={1}>
        <Label>Kaynaklar · {card.sources.length}</Label>
        <Card style={{ marginTop: 8 }}>
          {card.sources.length === 0 && (
            <Soft>Henüz kaynak yok. GitHub'ı bağla; sistem repolarından sinyal çıkarsın.</Soft>
          )}
          {card.sources.map((src) => (
            <View key={src.id} style={s.srcRow}>
              <Text style={s.srcKind}>{KIND[src.kind]}</Text>
              <Text style={s.srcRef} numberOfLines={1}>
                {src.ref}
              </Text>
              <Text
                style={{ color: src.ownershipVerified ? c.verified : c.declared, fontSize: 11 }}
              >
                {src.ownershipVerified ? 'doğrulandı' : 'beyan'}
              </Text>
            </View>
          ))}
          <View style={{ marginTop: 12, gap: 8 }}>
            {card.talent.githubConnected ? (
              <Button
                title={busy === 'sync' ? 'Okunuyor…' : 'GitHub sinyallerini yenile'}
                kind="ghost"
                disabled={busy === 'sync'}
                onPress={() =>
                  void run('sync', () => api('/api/me/evidence/github/sync', { method: 'POST' }))
                }
              />
            ) : (
              <Button
                title="GitHub'ı bağla (tarayıcıda)"
                kind="ink"
                onPress={() => void installGithub()}
              />
            )}
          </View>
        </Card>
      </Enter>
      <Enter i={2}>
        <View style={{ marginTop: 22 }}>
          <Label>
            İddialar · {onayli}/{card.claims.length} onaylı
          </Label>
        </View>
        {card.claims.length === 0 && (
          <Soft style={{ marginTop: 8 }}>
            Kaynak bağlayınca ajan taslak yazar; her satırı sen onaylarsın.
          </Soft>
        )}
        {card.claims.map((cl) => (
          <Card key={cl.id} style={{ marginTop: 8, opacity: cl.approved ? 1 : 0.92 }}>
            <Text style={s.claim}>{cl.text}</Text>
            <View style={s.meta}>
              <Badge
                text={LEVEL[cl.level].label}
                color={LEVEL[cl.level].color}
                bg={LEVEL[cl.level].bg}
              />
              {cl.periodStart && (
                <Text style={s.metaText}>
                  {ay(cl.periodStart)} → {ay(cl.periodEnd) ?? 'devam'}
                </Text>
              )}
              <Text style={s.metaText}>{cl.sourceIds.length} kaynak</Text>
            </View>
            <View style={s.actions}>
              {!cl.approved ? (
                <Pressable
                  disabled={busy === cl.id}
                  onPress={() =>
                    void run(cl.id, () =>
                      api(`/api/me/card/claims/${cl.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ approved: true }),
                      }),
                    )
                  }
                >
                  <Text style={s.approve}>Onayla</Text>
                </Pressable>
              ) : (
                <Text style={{ color: c.verified, fontSize: 12, fontWeight: '700' }}>Onaylı</Text>
              )}
              <Pressable
                disabled={busy === cl.id}
                onPress={() =>
                  Alert.alert('İddiayı sil?', cl.text, [
                    { text: 'Vazgeç', style: 'cancel' },
                    {
                      text: 'Sil',
                      style: 'destructive',
                      onPress: () =>
                        void run(cl.id, () =>
                          api(`/api/me/card/claims/${cl.id}`, { method: 'DELETE' }),
                        ),
                    },
                  ])
                }
              >
                <Text style={{ color: c.inkSoft, fontSize: 12 }}>Sil</Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </Enter>
      <Enter i={3}>
        <View style={{ marginTop: 22, gap: 10 }}>
          {!approved && (
            <>
              <Button
                title="Kartı onayla ve ağa gir"
                disabled={onayli === 0 || busy === 'approve'}
                onPress={() =>
                  void run('approve', () => api('/api/me/card/approve', { method: 'POST' }))
                }
              />
              {onayli === 0 && <Soft>En az bir iddiayı onaylaman gerekiyor.</Soft>}
            </>
          )}
          {approved && (
            <Card>
              <Label>Paylaşılabilir kart</Label>
              <Soft style={{ marginTop: 4 }}>
                Linki bilen görür: yalnız onaylı iddialar; e-posta ve GitHub adı yok.
              </Soft>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Button
                  title={card.talent.publicSlug ? 'Kapat' : 'Aç'}
                  kind="ghost"
                  disabled={busy === 'share'}
                  onPress={() =>
                    void run('share', () =>
                      api('/api/me/card/share', {
                        method: 'POST',
                        body: JSON.stringify({ enabled: !card.talent.publicSlug }),
                      }),
                    )
                  }
                />
                {card.talent.publicSlug && (
                  <Button
                    title="Paylaş"
                    onPress={() =>
                      void Share.share({
                        message: `${API_ORIGIN.replace(':3100', ':5100')}/k/${card.talent.publicSlug}`,
                      })
                    }
                  />
                )}
              </View>
            </Card>
          )}
          <Pressable onPress={() => void RNLinking.openURL('https://github.com/wmb-tech/zemin360')}>
            <Soft style={{ textAlign: 'center', marginTop: 8 }}>
              {me?.email} · Evidex açık kaynak
            </Soft>
          </Pressable>
        </View>
      </Enter>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 60 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  status: { marginTop: 12, gap: 6 },
  silent: { color: c.declared, fontSize: 12 },
  story: { color: c.ink, fontSize: 15, lineHeight: 22, marginTop: 14, marginBottom: 18 },
  srcRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  srcKind: { fontSize: 11, fontWeight: '700', color: c.inkSoft, width: 84 },
  srcRef: { flex: 1, fontSize: 13, color: c.ink, fontFamily: 'Menlo' },
  claim: { fontSize: 14, lineHeight: 20, color: c.ink },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  metaText: { color: c.inkSoft, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 10, alignItems: 'center' },
  approve: { color: c.accent, fontSize: 12, fontWeight: '700' },
});
