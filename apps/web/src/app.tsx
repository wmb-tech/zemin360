import { Navigate, Route, Routes } from 'react-router';
import { Shell } from './components/shell';
import { AuthProvider, useAuth } from './lib/auth';
import { LoginPage } from './pages/login';
import { NeedDetailPage, NeedsListPage } from './pages/needs';
import { CandidatesPage } from './pages/candidates';
import { OperatorQueuePage } from './pages/operator-queue';
import { TalentCardPage } from './pages/talent-card';
import { MetricsPage } from './pages/metrics';
import { OperatorChallengesPage } from './pages/operator-challenges';
import { TalentChallengesPage } from './pages/talent-challenges';
import { CollaborationsPage } from './pages/collaborations';
import { CheckinPage } from './pages/checkin';
import { NetworkPage } from './pages/network';
import { PublicCardPage } from './pages/public-card';
import { LandingPage } from './pages/landing';

const NAV = {
  talent: [
    { to: '/kart', label: 'Kartım' },
    { to: '/davetler', label: 'Meydan okumalar' },
  ],
  organization: [{ to: '/ihtiyaclar', label: 'İhtiyaçlar' }],
  operator: [
    { to: '/kuyruk', label: 'Onay kuyruğu' },
    { to: '/ag', label: 'Ağ' },
    { to: '/meydan', label: 'Meydan okumalar' },
    { to: '/isbirlikleri', label: 'İş birlikleri' },
    { to: '/olcum', label: 'Ölçüm' },
  ],
} as const;

function Routed() {
  const { me, loading } = useAuth();
  if (loading) return null;
  if (!me)
    return (
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="/giris" element={<LoginPage />} />
        {/* Oturumsuz derin linkler (e-postadan gelen) girişe döner; giriş sonrası rol ana sayfası */}
        <Route path="*" element={<Navigate to="/giris" replace />} />
      </Routes>
    );

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
            <Route path="/davetler" element={<TalentChallengesPage />} />
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
            <Route path="/meydan" element={<OperatorChallengesPage />} />
            <Route path="/ag" element={<NetworkPage />} />
            <Route path="/isbirlikleri" element={<CollaborationsPage />} />
            <Route path="/olcum" element={<MetricsPage />} />
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
      <Routes>
        {/* Oturumsuz sayfalar: e-postadaki linkle gelenler */}
        <Route path="/takip/:token" element={<CheckinPage />} />
        <Route path="/k/:slug" element={<PublicCardPage />} />
        <Route path="*" element={<Routed />} />
      </Routes>
    </AuthProvider>
  );
}
