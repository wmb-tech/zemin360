import { Navigate, Route, Routes } from 'react-router';
import { Shell } from './components/shell';
import { AuthProvider, useAuth } from './lib/auth';
import { LoginPage } from './pages/login';
import { Placeholder } from './pages/placeholder';
import { NeedDetailPage, NeedsListPage } from './pages/needs';
import { CandidatesPage } from './pages/candidates';
import { OperatorQueuePage } from './pages/operator-queue';
import { TalentCardPage } from './pages/talent-card';

const NAV = {
  talent: [
    { to: '/kart', label: 'Kartım' },
    { to: '/davetler', label: 'Davetler' },
  ],
  organization: [{ to: '/ihtiyaclar', label: 'İhtiyaçlar' }],
  operator: [
    { to: '/kuyruk', label: 'Onay kuyruğu' },
    { to: '/ag', label: 'Ağ' },
    { to: '/isbirlikleri', label: 'İş birlikleri' },
    { to: '/olcum', label: 'Ölçüm' },
  ],
} as const;

function Routed() {
  const { me, loading } = useAuth();
  if (loading) return null;
  if (!me) return <LoginPage />;

  const nav = [...NAV[me.role]];
  const home = nav[0]!.to;

  return (
    <Routes>
      <Route element={<Shell nav={nav} />}>
        <Route index element={<Navigate to={home} replace />} />
        {me.role === 'talent' && (
          <>
            <Route path="/kart" element={<TalentCardPage />} />
            <Route path="/kanit" element={<TalentCardPage />} />
            <Route
              path="/davetler"
              element={<Placeholder title="Davetler" note="Tanıştırmalar ve meydan okumalar." />}
            />
          </>
        )}
        {me.role === 'organization' && (
          <>
            <Route path="/ihtiyaclar" element={<NeedsListPage />} />
            <Route path="/ihtiyaclar/:id" element={<NeedDetailPage />} />
            <Route path="/ihtiyaclar/:id/adaylar" element={<CandidatesPage />} />
          </>
        )}
        {me.role === 'operator' && (
          <>
            <Route path="/kuyruk" element={<OperatorQueuePage />} />
            <Route
              path="/ag"
              element={<Placeholder title="Ağ" note="Gençler ve kurumlar; kart durumları." />}
            />
            <Route
              path="/isbirlikleri"
              element={
                <Placeholder
                  title="İş birlikleri"
                  note="Tanıştırıldı → görüşme → başladı → bitti."
                />
              }
            />
            <Route
              path="/olcum"
              element={<Placeholder title="Ölçüm" note="AI'ın katkısı: beş metrik." />}
            />
          </>
        )}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routed />
    </AuthProvider>
  );
}
