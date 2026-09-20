import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/lib/auth';
import { c } from './src/lib/theme';
import { LoginScreen } from './src/screens/login';
import { CardScreen } from './src/screens/card';
import { ChallengesScreen } from './src/screens/challenges';

/**
 * Genç uygulaması (KARAR-12: mobil ilk aşamada yalnız genç tarafı). İki sekme: Kartım ve
 * Meydan okumalar. Yönlendirme kütüphanesi yok; iki ekran için state yeter, büyüyünce
 * expo-router'a geçilir.
 */
const TABS = [
  { key: 'card', label: 'Kartım' },
  { key: 'challenges', label: 'Meydan okumalar' },
] as const;
type Tab = (typeof TABS)[number]['key'];

function Root() {
  const { me, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('card');
  if (loading) return <View style={{ flex: 1, backgroundColor: c.paper }} />;
  if (!me) return <LoginScreen />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ flex: 1 }}>{tab === 'card' ? <CardScreen /> : <ChallengesScreen />}</View>
      <View style={s.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={s.tab}>
            <Text style={[s.tabText, tab === t.key && s.tabActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Root />
    </AuthProvider>
  );
}

const s = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: c.line,
    backgroundColor: c.paper,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { color: c.inkSoft, fontSize: 13, fontWeight: '600' },
  tabActive: { color: c.accent },
});
