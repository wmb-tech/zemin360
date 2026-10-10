import { Navigate, Route, Routes } from 'react-router';
import { Shell, type NavItem } from './components/shell';
import { AuthProvider, useAuth } from './lib/auth';
import { LoginPage } from './pages/login';
import { NeedDetailPage, NeedsListPage } from './pages/needs';
import { CandidatesPage } from './pages/candidates';
import { OperatorQueuePage } from './pages/operator-queue';
import { TalentCardPage } from './pages/talent-card';
import { MetricsPage } from './pages/metrics';
import { DemoMailPage } from './pages/demo-mail';
import { PrivacyPage } from './pages/gizlilik';
import { AccountPage } from './pages/account';
import { OperatorChallengesPage } from './pages/operator-challenges';
import { TalentChallengesPage } from './pages/talent-challenges';
import { CollaborationsPage } from './pages/collaborations';
import { CheckinPage } from './pages/checkin';
import { NetworkPage } from './pages/network';
import { PublicCardPage } from './pages/public-card';
import { LandingPage } from './pages/landing';
import { TalentHomePage } from './pages/talent-home';
import { OrgSettingsPage } from './pages/org-settings';
import { OperatorNeedsPage } from './pages/operator-needs';
import { Skeleton } from './components/ui';
import { IntroductionsPage } from './pages/introductions';
import { DeliveriesPage } from './pages/deliveries';

const NAV = {
  talent: [
    { to: '/durum', label: 'Durum', icon: 'home' },
    { to: '/kart', label: 'Kartım', icon: 'card' },
    { to: '/davetler', label: 'Meydan okumalar', icon: 'flag' },
    { to: '/hesap', label: 'Hesap', icon: 'account' },
    { to: '/tanistirmalar', label: 'Tanıştırmalar', icon: 'collab' },
  ],
  organization: [
    { to: '/ihtiyaclar', label: 'İhtiyaçlar', icon: 'needs' },
    { to: '/kurum', label: 'Kurum', icon: 'org' },
    { to: '/tanistirmalar', label: 'Tanıştırmalar', icon: 'collab' },
  ],
  operator: [
    { to: '/kuyruk', label: 'Onay kuyruğu', icon: 'queue' },
    { to: '/ihtiyaclar', label: 'İhtiyaçlar', icon: 'needs' },
    { to: '/ag', label: 'Ağ', icon: 'network' },
    { to: '/meydan', label: 'Meydan okumalar', icon: 'flag' },
    { to: '/isbirlikleri', label: 'İş birlikleri', icon: 'collab' },
    { to: '/olcum', label: 'Ölçüm', icon: 'metrics' },
    { to: '/gonderimler', label: 'Gönderimler', icon: 'queue' },
  ],
} as const satisfies Record<string, readonly NavItem[]>;

function Routed() {
  const { me, loading } = useAuth();
  if (loading)
    return (
      <div className="mx-auto max-w-[1120px] px-6 py-10">
        <Skeleton rows={5} />
      </div>
    );
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
  // Kurumun adı yoksa önce onu yazsın: ihtiyaç açmadan, e-postalara "adı bekleniyor" girmeden.
  const home =
    me.role === 'organization' && me.organization?.needsName ? '/kurum?ilk=1' : nav[0]!.to;

  return (
    <Routes>
      <Route element={<Shell nav={nav} />}>
        <Route index element={<Navigate to={home} replace />} />
        <Route path="/nasil-calisir" element={<LandingPage />} />
        {me.role !== 'operator' && <Route path="/tanistirmalar" element={<IntroductionsPage />} />}
        {me.role === 'talent' && (
          <>
            <Route path="/durum" element={<TalentHomePage />} />
            <Route path="/kart" element={<TalentCardPage />} />
            <Route path="/kanit" element={<TalentCardPage />} />
            <Route path="/davetler" element={<TalentChallengesPage />} />
            <Route path="/hesap" element={<AccountPage />} />
          </>
        )}
        {me.role === 'organization' && (
          <>
            <Route path="/ihtiyaclar" element={<NeedsListPage />} />
            <Route path="/ihtiyaclar/:id" element={<NeedDetailPage />} />
            <Route path="/ihtiyaclar/:id/adaylar" element={<CandidatesPage />} />
            <Route path="/kurum" element={<OrgSettingsPage />} />
          </>
        )}
        {me.role === 'operator' && (
          <>
            <Route path="/kuyruk" element={<OperatorQueuePage />} />
            <Route path="/ihtiyaclar" element={<OperatorNeedsPage />} />
            <Route path="/meydan" element={<OperatorChallengesPage />} />
            <Route path="/ag" element={<NetworkPage />} />
            <Route path="/demo-posta" element={<DemoMailPage />} />
            <Route path="/isbirlikleri" element={<CollaborationsPage />} />
            <Route path="/olcum" element={<MetricsPage />} />
            <Route path="/gonderimler" element={<DeliveriesPage />} />
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
        <Route path="/gizlilik" element={<PrivacyPage />} />
        <Route path="*" element={<Routed />} />
      </Routes>
    </AuthProvider>
  );
}
