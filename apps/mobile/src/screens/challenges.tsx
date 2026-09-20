import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';
import { c } from '../lib/theme';
import { Button, Card, H1, Label, Soft } from '../ui';

interface OpenChallenge {
  id: string;
  title: string;
  brief: string;
  rubric: { name: string; weight: number; description: string }[];
  durationHours: number;
  closesAt: string | null;
  mySubmission: { repoUrl: string; note: string | null; submittedAt: string } | null;
}

/** Meydan okumalar (keşfet 01): açık görevler, teslim. Web'deki /davetler ile aynı uçlar. */
export function ChallengesScreen() {
  const [list, setList] = useState<OpenChallenge[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await api<OpenChallenge[]>('/api/me/challenges'));
    } catch (e) {
      Alert.alert('Yüklenemedi', e instanceof Error ? e.message : 'Hata');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function submit(id: string) {
    setBusy(true);
    try {
      await api(`/api/me/challenges/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ repoUrl: repoUrl.trim(), note: note.trim() || null }),
      });
      setRepoUrl('');
      setNote('');
      setOpen(null);
      await load();
    } catch (e) {
      Alert.alert('Teslim edilemedi', e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: c.paper }} contentContainerStyle={s.wrap}>
      <H1>Meydan okumalar</H1>
      <Soft style={{ marginTop: 6 }}>
        Gerçek kurum ihtiyaçlarından türetilmiş 24–48 saatlik görevler. Teslimin, değerlendirmesiyle
        birlikte kartına doğrulanmış kanıt olarak girer. Yapay zekâ araçları serbest; ölçülen şey
        çalışan teslimat.
      </Soft>
      {list?.length === 0 && (
        <Card style={{ marginTop: 16 }}>
          <Soft>Şu an açık meydan okuma yok.</Soft>
        </Card>
      )}
      {list?.map((ch) => (
        <Card key={ch.id} style={{ marginTop: 12 }}>
          <Pressable onPress={() => setOpen(open === ch.id ? null : ch.id)}>
            <Text style={s.title}>{ch.title}</Text>
            <Soft>
              {ch.durationHours} saat
              {ch.closesAt ? ` · son teslim ${new Date(ch.closesAt).toLocaleString('tr-TR')}` : ''}
              {ch.mySubmission ? ' · teslim edildi' : ''}
            </Soft>
          </Pressable>
          {(open === ch.id || ch.mySubmission) && (
            <View style={{ marginTop: 10 }}>
              <Text style={s.brief}>{ch.brief}</Text>
              <View style={{ marginTop: 10 }}>
                <Label>Nasıl değerlendirilecek</Label>
              </View>
              {ch.rubric.map((r) => (
                <Text key={r.name} style={s.rubric}>
                  <Text style={{ fontWeight: '700' }}>{r.name}</Text>
                  <Text style={{ color: c.inkSoft }}> — {r.description}</Text>
                </Text>
              ))}
              {ch.mySubmission ? (
                <Soft style={{ marginTop: 10 }}>
                  Teslimin: {ch.mySubmission.repoUrl} ·{' '}
                  {new Date(ch.mySubmission.submittedAt).toLocaleString('tr-TR')}
                </Soft>
              ) : (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <TextInput
                    value={repoUrl}
                    onChangeText={setRepoUrl}
                    placeholder="https://github.com/kullanici/repo"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={s.input}
                    placeholderTextColor={c.declared}
                  />
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Kısa not (nasıl çalıştırılır) — isteğe bağlı"
                    style={s.input}
                    placeholderTextColor={c.declared}
                  />
                  <Button
                    title={busy ? 'Gönderiliyor…' : 'Teslim et'}
                    disabled={busy || !repoUrl.trim()}
                    onPress={() => void submit(ch.id)}
                  />
                </View>
              )}
            </View>
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 16, fontWeight: '700', color: c.ink },
  brief: { fontSize: 14, lineHeight: 20, color: c.ink },
  rubric: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: c.ink,
  },
});
