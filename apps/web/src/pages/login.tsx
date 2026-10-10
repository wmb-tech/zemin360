import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, GitBranch, MailCheck, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Enter } from '../components/motion';
import { Button, ErrorNote, Eyebrow, Input, LevelBadge } from '../components/ui';

/** Email supports talent and organization signup; existing account roles are preserved. */
const HATA: Record<string, { baslik: string; metin: string }> = {
  invalid_link: {
    baslik: 'Bu bağlantı artık geçerli değil',
    metin:
      'Giriş bağlantıları 15 dakika geçerli ve tek kullanımlık. Aşağıdan yeni bir bağlantı iste.',
  },
  installation_owner_mismatch: {
    baslik: 'GitHub App yanlış hesaba kuruldu',
    metin:
      'Kurulum kişisel hesabına değil bir organizasyona yapılmış. GitHub\'da "Settings → Applications → Evidex by WMB" altından kaldırıp tekrar dene; bu kez doğrudan kendi hesabına kurulur.',
  },
  installation_not_yours: {
    baslik: 'Bu organizasyonun üyesi görünmüyorsun',
    metin:
      'Evidex yalnız üyesi olduğun organizasyonların kurulumunu okur. Organizasyon yöneticinden üyeliğini görünür yapmasını iste ya da kişisel hesabınla devam et.',
  },
  email_in_use: {
    baslik: 'Bu e-posta başka bir rolde kayıtlı',
    metin:
      "GitHub hesabının e-postası, Evidex'te bir kurum ya da GİRVAK hesabına ait. Genç kartı için farklı bir e-postası olan bir GitHub hesabıyla gir; ya da o hesaba e-posta bağlantısıyla giriş yap.",
  },
  oauth_state: {
    baslik: 'GitHub dönüşü doğrulanamadı',
    metin: 'Süre dolmuş olabilir. "GitHub ile devam et" ile tekrar dene.',
  },
  not_configured: {
    baslik: 'GitHub girişi bu ortamda kapalı',
    metin: 'Bu ortamda GitHub girişi kapalı. E-postayla devam edebilirsin.',
  },
};

/**
 * Giriş (docs/redesign/01 §Entry). Kabuk yok; tek sütun, iki yol. Hata durumları API kodundan
 * okunur (`?hata=`), çıplak kod kullanıcıya gösterilmez. Gönderim sonrası ekran "gönderildi"
 * durumuna geçer; kullanıcı aynı adrese tekrar isteyebilir.
 */
export function LoginPage() {
  useTitle('Giriş');
  const [params] = useSearchParams();
  const hataKodu = params.get('hata');
  const hata = hataKodu
    ? (HATA[hataKodu] ?? {
        baslik: 'Giriş tamamlanamadı',
        metin: `Beklenmeyen bir durum oluştu (${hataKodu}). Tekrar dene; sürerse GİRVAK'a yaz.`,
      })
    : null;
  const [email, setEmail] = useState('');
  const [signupRole, setSignupRole] = useState<'talent' | 'organization'>('organization');
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/api/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email, signupRole }),
      });
      setSent(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bağlantı gönderilemedi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[488px] flex-col justify-center px-6 py-10 lg:py-16">
        <Enter i={0} as="header">
          <Link
            to="/"
            className="text-ink-soft mb-10 inline-flex min-h-11 items-center gap-2 text-sm font-semibold hover:text-ink"
          >
            <ArrowLeft size={15} aria-hidden />
            Ana sayfa
          </Link>
          <a href="/" className="wordmark text-ink block w-fit text-[30px]">
            Evidex.
          </a>
          <h1 className="text-ink mt-7 text-[32px] leading-tight font-extrabold tracking-[-0.035em]">
            İşin seni anlatsın.
          </h1>
          <p className="text-ink-soft mt-3 max-w-[38ch] text-base">
            Kanıtlarını fırsatlarla buluşturan GİRVAK ağına katıl.
          </p>
        </Enter>

        {hata && (
          <Enter i={1} as="section" className="mt-8">
            <div role="alert" className="bg-referenced-soft rounded-[var(--radius-panel)] p-4">
              <div className="text-referenced font-bold">{hata.baslik}</div>
              <p className="text-ink mt-1 text-sm leading-relaxed">{hata.metin}</p>
            </div>
          </Enter>
        )}

        <Enter i={hata ? 2 : 1} as="section" className="mt-8">
          <Eyebrow>Genç yetenekler için</Eyebrow>
          <h2 className="text-ink mt-1 text-lg font-bold tracking-[-0.02em]">
            GitHub hesabınla devam et
          </h2>
          <p className="text-ink-soft mt-1 text-sm leading-relaxed">
            GitHub hesabınla giriş yap; hangi repoların okunacağını sonraki adımda sen seçersin. Kod
            saklanmaz, yalnız sinyal çıkarılır.
          </p>
          <a
            href="/api/auth/github"
            className="bg-ink text-paper pressable mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold hover:opacity-90"
          >
            <GitBranch size={18} aria-hidden /> GitHub ile devam et{' '}
            <ArrowRight size={16} className="ml-auto" aria-hidden />
          </a>
          <button
            type="button"
            disabled={busy}
            className="text-accent mt-3 min-h-11 text-sm font-semibold hover:underline"
            onClick={() => {
              setSignupRole('talent');
              setSent(null);
            }}
          >
            GitHub hesabın yok mu? E-postayla devam et
          </button>
        </Enter>

        <div className="border-line my-8 border-t" />

        <Enter i={hata ? 3 : 2} as="section">
          <Eyebrow>
            {signupRole === 'talent' ? 'Yetenek kartı · E-posta' : 'Kurum · GİRVAK'}
          </Eyebrow>
          <h2 className="text-ink mt-1 text-lg font-bold tracking-[-0.02em]">
            {signupRole === 'talent' ? 'E-postayla devam et' : 'Çalışma alanına giriş yap'}
          </h2>
          {sent ? (
            <div className="bg-verified-soft mt-3 rounded-[var(--radius-panel)] p-4" role="status">
              <div className="text-verified flex items-center gap-2 font-bold">
                <MailCheck size={18} aria-hidden /> Bağlantı gönderildi
              </div>
              <p className="text-ink mt-1 text-sm leading-relaxed">
                <b>{sent}</b> adresine giriş bağlantısı gitti. 15 dakika geçerli, tek kullanımlık.
                Gelmezse istenmeyen klasörüne bak.
              </p>
              <button
                type="button"
                onClick={() => setSent(null)}
                className="text-accent mt-2 text-sm font-semibold hover:underline"
              >
                Başka adrese gönder
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void submit(e)} className="mt-3">
              <fieldset disabled={busy} className="mb-4">
                <legend className="text-ink mb-2 text-sm font-semibold">
                  İlk kez katılıyorsan
                </legend>
                <div className="flex flex-wrap gap-4">
                  <label className="text-ink inline-flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="signup-role"
                      value="talent"
                      checked={signupRole === 'talent'}
                      onChange={() => setSignupRole('talent')}
                    />
                    Yetenek kartı oluştur
                  </label>
                  <label className="text-ink inline-flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="signup-role"
                      value="organization"
                      checked={signupRole === 'organization'}
                      onChange={() => setSignupRole('organization')}
                    />
                    Kurum hesabı oluştur
                  </label>
                </div>
              </fieldset>
              <p className="text-ink-soft text-sm leading-relaxed">
                Şifre yok. Adresine tek kullanımlık bağlantı gelir. Mevcut hesabın varsa rolün
                değişmez.
              </p>
              <label className="text-ink mt-4 block text-sm font-semibold" htmlFor="login-email">
                E-posta adresin
              </label>
              <div className="mt-2 grid gap-3">
                <Input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={signupRole === 'talent' ? 'ad@eposta.com' : 'ad@kurum.com'}
                  className="flex-1"
                />
                <Button type="submit" variant="primary" pending={busy} pendingText="Gönderiliyor…">
                  Bağlantı gönder
                </Button>
              </div>
              {error && <ErrorNote>{error}</ErrorNote>}
            </form>
          )}
        </Enter>

        <p className="text-ink-soft mt-10 text-xs">
          Giriş yaparak yalnız seçtiğin kaynakların okunmasına izin verirsin; kimliğin tanıştırma
          onaylanana kadar kurumlara görünmez.{' '}
          <a href="/nasil-calisir" className="text-accent font-semibold hover:underline">
            Nasıl çalışır
          </a>
          {' · '}
          <Link to="/gizlilik" className="text-accent font-semibold hover:underline">
            Aydınlatma metni
          </Link>
        </p>
      </div>
      <GirisVitrin />
    </div>
  );
}

const ADIMLAR = [
  { n: '1', baslik: 'Bağla', metin: 'GitHub, canlı ürün veya PDF belgenle başla.' },
  { n: '2', baslik: 'Okut', metin: 'Ajan işlerini kanıttan okur; kod saklanmaz.' },
  { n: '3', baslik: 'Onayla', metin: 'Taslağı düzelt, onayla; kartın ağa girer.' },
];

/**
 * Girişin sağ yarısı (geniş ekran): gencin "neden bağlayayım?" sorusuna cevap — üç adım ve
 * kartın neye benzediği. Örnek açıkça örnek olarak etiketli; gerçek bir kişinin kartı değil.
 */
function GirisVitrin() {
  return (
    <aside
      aria-label="Evidex nasıl çalışır"
      className="bg-paper border-line hidden min-h-screen flex-col justify-center border-l px-10 py-16 lg:flex xl:px-16"
    >
      <div className="mx-auto w-full max-w-[460px]">
        <div className="text-accent flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={18} aria-hidden />
          Kanıtla başlayan bir ağ
        </div>
        <h2 className="text-ink mt-4 text-[36px] leading-[1.18] font-extrabold tracking-[-0.035em]">
          Ne yaptığın görünür.
          <br />
          Neden uyduğun anlaşılır.
        </h2>
        <p className="text-ink-soft mt-4 mb-8 max-w-[42ch] text-sm leading-relaxed">
          Her iddianın bir kaynağı, her eşleşmenin bir gerekçesi var. Kartını sen onaylarsın,
          tanıştırmayı GİRVAK yapar.
        </p>
        <ol className="grid grid-cols-3 gap-4">
          {ADIMLAR.map((a) => (
            <li key={a.n}>
              <span className="bg-ink text-surface grid size-7 place-items-center rounded-full text-xs font-bold">
                {a.n}
              </span>
              <div className="text-ink mt-2 text-sm font-bold">{a.baslik}</div>
              <p className="text-ink-soft mt-0.5 text-xs leading-relaxed">{a.metin}</p>
            </li>
          ))}
        </ol>

        <div className="bg-surface border-line mt-8 rounded-[var(--radius-panel)] border p-6 shadow-[var(--shadow-panel)]">
          <div className="flex items-center justify-between">
            <Eyebrow>Kanıta dayalı kart</Eyebrow>
            <span className="text-ink-soft text-[11px] font-semibold">Örnek</span>
          </div>
          <div className="text-ink mt-2 text-2xl font-extrabold tracking-[-0.03em]">Elif K.</div>
          <div className="text-ink-soft text-sm">Mobil uygulama geliştirici · İstanbul</div>
          <ul className="divide-line border-line mt-4 divide-y border-t">
            <li className="py-3">
              <div className="flex flex-col items-start gap-2">
                <LevelBadge level="verified" />
                <p className="text-ink text-sm leading-relaxed">
                  Kafe zincirinin sipariş uygulamasını on ay tek başına geliştirip canlıda tuttu.
                </p>
              </div>
              <div className="text-ink-soft mt-1 pl-1 text-xs">Kas 2025 → Eyl 2026 · 2 kaynak</div>
            </li>
            <li className="py-3">
              <div className="flex flex-col items-start gap-2">
                <LevelBadge level="referenced" />
                <p className="text-ink text-sm leading-relaxed">
                  GİRVAK onaylı bir kurum iş birliğini "tamamlandı" olarak değerlendirdi.
                </p>
              </div>
              <div className="text-ink-soft mt-1 pl-1 text-xs">Platformda izlenen iş birliği</div>
            </li>
          </ul>
          <div className="border-line mt-2 border-t pt-4 text-sm">
            <span className="text-verified font-bold">Uyuyor, çünkü </span>
            <span className="text-ink">ihtiyaçla örtüşen, sürdürülmüş ve canlıda bir iş var.</span>
          </div>
        </div>
        <p className="text-ink-soft mt-4 text-xs">
          Kurum seni ilk adınla ve gerekçesiyle görür; iletişim bilgin GİRVAK tanıştırana kadar
          paylaşılmaz.
        </p>
      </div>
    </aside>
  );
}
