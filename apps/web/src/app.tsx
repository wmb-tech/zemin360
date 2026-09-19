import { Navigate, Route, Routes } from 'react-router';
import { Shell } from './components/shell';
import { AuthProvider, useAuth } from './lib/auth';
import { LoginPage } from './pages/login';
import { Placeholder } from './pages/placeholder';

const NAV = {
  talent: [
    { to: '/kart', label: 'Kartım' },
    { to: '/kanit', label: 'Kanıtlarım' },
    { to: '/davetler', label: 'Davetler' },
  ],
  organization: [
    { to: '/ihtiyaclar', label: 'İhtiyaçlar' },
    { to: '/adaylar', label: 'Adaylar' },
  ],
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
            <Route
              path="/kart"
              element={
                <Placeholder
                  title="Kartım"
                  note="Kanıttan üretilen yetkinlik kartın burada olacak; her satırın kaynağı, seviyesi ve zamanı görünecek."
                />
              }
            />
            <Route
              path="/kanit"
              element={
                <Placeholder
                  title="Kanıtlarım"
                  note="GitHub repoları, canlı ürünler ve belgeler. Kod saklanmaz; sinyal çıkarılır."
                />
              }
            />
            <Route
              path="/davetler"
              element={<Placeholder title="Davetler" note="Tanıştırmalar ve meydan okumalar." />}
            />
          </>
        )}
        {me.role === 'organization' && (
          <>
            <Route
              path="/ihtiyaclar"
              element={
                <Placeholder
                  title="İhtiyaçlar"
                  note="Derdini anlat; ajan soru sorup net bir ihtiyaç kartına çevirsin."
                />
              }
            />
            <Route
              path="/adaylar"
              element={
                <Placeholder
                  title="Adaylar"
                  note="Gerekçeli öneriler: uyuyor çünkü… / eksik olan…"
                />
              }
            />
          </>
        )}
        {me.role === 'operator' && (
          <>
            <Route
              path="/kuyruk"
              element={
                <Placeholder
                  title="Onay kuyruğu"
                  note="Ajanın önerdiği her dışa dönük eylem burada bekler; tek tıkla gider."
                />
              }
            />
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
