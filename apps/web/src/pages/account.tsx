import { Link } from 'react-router';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTitle } from '../lib/title';
import { Enter } from '../components/motion';
import { HesapSil } from '../components/hesap-sil';
import { Panel } from '../components/ui';
import { WorkPreferences } from '../components/work-preferences';

/**
 * Gencin hesabı: kim olarak girdiği, GitHub bağlantısı, verisi ve hesabı silme. Durum sayfası
 * işe odaklı kalsın diye ayrı (silme düğmesi ana ekranda gereğinden fazla göze batıyordu).
 */
export function AccountPage() {
  useTitle('Hesap');
  const { me } = useAuth();
  if (!me) return null;
  return (
    <div className="max-w-2xl">
      <Enter i={0} as="header">
        <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
          Hesap
        </h1>
        <p className="text-ink-soft mt-1">
          Kim olarak girdiğin, neyin okunduğu ve verinin kontrolü.
        </p>
      </Enter>
      <Enter i={1} as="section" className="mt-6">
        <Panel className="divide-line divide-y">
          <Satir etiket="Ad">{me.name}</Satir>
          <Satir etiket="E-posta">
            {me.email}
            <span className="text-ink-soft block text-xs">
              Kurumlar görmez; tanıştırma e-postası GİRVAK onayıyla buraya gelir.
            </span>
          </Satir>
          <Satir etiket="GitHub">
            {me.githubLogin ? `@${me.githubLogin}` : 'Bağlı değil'}
            <a
              href="https://github.com/settings/installations"
              target="_blank"
              rel="noreferrer"
              className="text-accent mt-1 flex items-center gap-1 text-xs font-semibold hover:underline"
            >
              Okunan repoları GitHub'da değiştir <ExternalLink size={12} aria-hidden />
            </a>
          </Satir>
          <Satir etiket="Verin">
            Repolardan yalnız sinyal okunur, kod saklanmaz.{' '}
            <Link to="/gizlilik" className="text-accent font-semibold hover:underline">
              Aydınlatma metni
            </Link>
          </Satir>
        </Panel>
      </Enter>
      <WorkPreferences />
      <HesapSil rol="talent" />
    </div>
  );
}

function Satir({ etiket, children }: { etiket: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-5 py-4 sm:grid-cols-[140px_1fr] sm:gap-4">
      <div className="text-ink-soft text-sm font-semibold">{etiket}</div>
      <div className="text-ink text-sm">{children}</div>
    </div>
  );
}
