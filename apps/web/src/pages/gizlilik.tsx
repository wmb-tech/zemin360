import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTitle } from '../lib/title';

function Bolum({ baslik, children }: { baslik: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-ink text-lg font-bold">{baslik}</h2>
      <div className="text-ink-soft mt-2 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

/**
 * KVKK aydınlatma metni. Yalnız ürünün gerçekten yaptığını yazar; her madde koddaki bir
 * davranışa karşılık gelir (sinyal çıkarımı, kod saklamama, hesabını sil, e-posta, AI işleme).
 */
export function PrivacyPage() {
  useTitle('Aydınlatma metni');
  return (
    <main className="bg-paper min-h-screen px-4 py-10">
      <article className="mx-auto max-w-[68ch]">
        <Link to="/" className="text-ink text-lg font-extrabold tracking-[-0.03em]">
          Evidex
        </Link>
        <h1 className="text-ink mt-6 text-[28px] leading-tight font-extrabold tracking-[-0.035em]">
          Kişisel verilerin korunması: aydınlatma metni
        </h1>
        <p className="text-ink-soft mt-2 text-sm">Son güncelleme: 5 Ekim 2026</p>

        <Bolum baslik="Kim işliyor">
          <p>
            Evidex, GİRVAK'ın Zemin360 Hackathon'u kapsamında WMB İleri Teknoloji Ltd. ekibinin
            geliştirip işlettiği bir prototiptir. Verileriniz bu süreçte yalnız platformun çalışması
            için işlenir. Sorularınız ve talepleriniz için:{' '}
            <a
              href="mailto:hasan.zengin@wmbyazilim.com"
              className="text-accent font-semibold hover:underline"
            >
              hasan.zengin@wmbyazilim.com
            </a>
          </p>
        </Bolum>

        <Bolum baslik="Hangi veriler">
          <p>
            <b className="text-ink">Gençler:</b> GitHub ile girişte GitHub kullanıcı adınız, adınız,
            e-posta adresiniz ve GitHub kimlik numaranız. GitHub uygulamasına izin verdiğiniz
            repolardan yalnız <b className="text-ink">sinyal</b> çıkarılır: kullanılan diller ve
            araçlar, sizin commit sayınız ve tarihleri, katkı oranınız, katkıcı sayısı, README'nin
            kısa bir özeti. <b className="text-ink">Kaynak kod saklanmaz.</b> Eklediğiniz canlı ürün
            adresi ve belgelerden de yalnız sinyal çıkarılır; belge dosyası saklanmaz.
          </p>
          <p>
            <b className="text-ink">Kurumlar:</b> e-posta adresi, kurum adı, şehir, web sitesi ve
            ihtiyaç sohbetinde yazdıklarınız.
          </p>
          <p>
            <b className="text-ink">Herkes:</b> tanıştırma sonrası takip sorularına verdiğiniz
            cevaplar ve platformdaki kararların denetim kaydı.
          </p>
        </Bolum>

        <Bolum baslik="Ne için">
          <p>
            Kanıta dayalı yetkinlik kartını yazmak, kurum ihtiyacını netleştirmek, ikisini
            gerekçesiyle eşleştirmek, GİRVAK'ın onayıyla tanıştırmak ve iş birliğini takip etmek.
            Kimliğiniz tanıştırma onaylanana kadar kurumlara gösterilmez; kurum adayı yalnız ilk
            adıyla ve gerekçesiyle görür. Kartınızı herkese açık paylaşmak sizin seçiminizdir ve
            paylaşılan kartta e-posta ya da GitHub adı yer almaz.
          </p>
        </Bolum>

        <Bolum baslik="Kimlerle paylaşılır">
          <p>
            Metin üretimi ve eşleştirme için sinyaller ve kart metinleri Google Cloud (Vertex AI)
            üzerinde çalışan modellere gönderilir. Platform Almanya'daki bir sunucuda (Hetzner)
            çalışır, e-postalar Google (Gmail) üzerinden gönderilir. Bu hizmetler yurt dışında
            bulunduğundan verileriniz yurt dışına aktarılır. Verileriniz bunların dışında kimseyle
            paylaşılmaz, satılmaz ve reklam için kullanılmaz.
          </p>
        </Bolum>

        <Bolum baslik="Ne kadar saklanır">
          <p>
            Hesabınızı silene kadar. <b className="text-ink">Hesabımı sil</b> düğmesi (genç: Durum
            sayfası, kurum: Kurum bilgileri) hesabınızı ve ona bağlı her şeyi hemen ve kalıcı olarak
            siler; denetim kaydında yalnız kişiyle bağı koparılmış işlem satırları kalır. GitHub
            uygulamasını{' '}
            <a
              href="https://github.com/settings/installations"
              target="_blank"
              rel="noreferrer"
              className="text-accent font-semibold hover:underline"
            >
              GitHub ayarlarından
            </a>{' '}
            istediğiniz an kaldırabilirsiniz; kaldırınca yeni okuma yapılamaz.
          </p>
        </Bolum>

        <Bolum baslik="Haklarınız">
          <p>
            KVKK'nın 11. maddesi gereği verilerinizin işlenip işlenmediğini öğrenme, bilgi isteme,
            düzeltilmesini ya da silinmesini isteme, itiraz etme ve zararın giderilmesini talep etme
            haklarınız vardır. Talebinizi yukarıdaki adrese yazabilirsiniz.
          </p>
        </Bolum>
      </article>
    </main>
  );
}
