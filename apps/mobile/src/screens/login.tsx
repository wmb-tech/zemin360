import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { c } from '../lib/theme';
import { Enter } from '../lib/motion';
import { Button, Soft } from '../ui';

/** Genç için tek giriş: GitHub (KARAR-07). Kurum ve operatör web'de. */
export function LoginScreen() {
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setError(null);
    try {
      await login();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Giriş yapılamadı');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.wrap}>
      <Enter i={0}>
        <Text style={s.brand}>Evidex</Text>
        <Text style={s.tag}>Beyan değil kanıt. Skor değil gerekçe.</Text>
      </Enter>
      <Soft style={{ marginTop: 16 }}>
        Kendini anlatma; kanıtını bağla. GitHub ile gir, hangi repoları göstereceğini sen seç. Kod
        saklanmaz, yalnız sinyal çıkarılır.
      </Soft>
      <View style={{ marginTop: 28 }}>
        <Button
          title={busy ? 'Açılıyor…' : 'GitHub ile devam et'}
          kind="ink"
          onPress={() => void go()}
          disabled={busy}
        />
      </View>
      {error && <Text style={{ color: c.red, marginTop: 10 }}>{error}</Text>}
      <Soft style={{ marginTop: 24 }}>Kurum ve GİRVAK girişi web üzerinden.</Soft>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: c.paper },
  brand: { fontSize: 34, fontWeight: '800', color: c.ink, letterSpacing: -1 },
  tag: { color: c.inkSoft, marginTop: 6, fontSize: 15 },
});
