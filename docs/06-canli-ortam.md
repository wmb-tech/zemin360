# Canlı ortam — tek VM, tek komut

> **Bugünkü canlı:** `evidex.wmbyazilim.com` → WMB Hetzner kutusu (62.238.61.164), kenar Caddy'nin
> `/srv/wmb/caddy/evidex.caddy` dosyası + `/opt/evidex/docker-compose.yml` (bu depodaki prod compose'un
> caddy'siz, `closer-edge` ağına bağlı hâli). Deploy kullanıcısı `evidex` (yalnız kendi compose'una sudo).
> Sırlar sunucuda `/opt/evidex/.env` ve `secrets/gcp.json`; GitHub'da yalnız SSH anahtarı.

Hedef (KARAR-14): 9 Ekim'de canlı adres. Tarif: Docker Compose + Caddy (HTTPS otomatik) +
GitHub Actions (imaj ghcr.io'ya, sunucuda `compose pull && up`). Tek süreç API + web; Postgres
aynı VM'de, günlük yedek.

## Sunucu (bir kez)
```bash
# Ubuntu 22.04+, 2 vCPU / 4 GB yeter. Docker kurulu.
sudo mkdir -p /opt/evidex/secrets && cd /opt/evidex
curl -O https://raw.githubusercontent.com/wmb-tech/zemin360/main/docker-compose.prod.yml
curl -O https://raw.githubusercontent.com/wmb-tech/zemin360/main/Caddyfile
# .env: .env.example'dan; en az şunlar:
#   SESSION_SECRET, WEB_ORIGIN=https://<host>, API_ORIGIN=https://<host>, POSTGRES_PASSWORD,
#   EVIDEX_HOST=<host>, LLM_PROVIDER=google, GOOGLE_CLOUD_PROJECT=..., LLM_MODEL=gemini-2.5-pro,
#   GITHUB_APP_*, GITHUB_CLIENT_*, GITHUB_SERVER_TOKEN, SMTP_URL (yoksa e-postalar konsola)
# Vertex servis hesabı anahtarı (rol: Vertex AI User) → /opt/evidex/secrets/gcp.json
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec api bun run --cwd packages/db seed   # isteğe bağlı tohum
```
DNS: `<host>` A kaydı → VM. Caddy sertifikayı kendisi alır (80/443 açık olmalı).
GitHub App ayarları: Callback URL `https://<host>/api/auth/github/callback`, Setup URL aynı.

## Dağıtım (her push)
`ci` yeşil → `deploy` iş akışı imajı `ghcr.io/wmb-tech/zemin360:<sha>` ve `:latest` olarak iter.
Depo sırları `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` tanımlıysa sunucuda compose yenilenir;
tanımlı değilse adım "atlandı" der (sessiz değil). Geri alma: `.env`'de `EVIDEX_TAG=<önceki sha>`,
`compose up -d`.

Migrasyon imaj açılışında koşar (`bun run --cwd packages/db migrate`); geriye dönük uyumsuz
migrasyon yazılmaz (docs/03).

## Yedek
```bash
# crontab -e (root): her gece 03:00, 30 gün sakla
0 3 * * * cd /opt/evidex && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U evidex evidex | gzip > backups/evidex-$(date +\%F).sql.gz && find backups -mtime +30 -delete
```

## Sağlık
- `https://<host>/api/health` → `{ ok: true }`
- Loglar: `docker compose -f docker-compose.prod.yml logs -f api` (ajan hataları, `[jobs]` satırları)
- Zamanlayıcı saatte bir: takip taraması + kanıt yenileme. Tek süreç varsayımı (ADR-0006).

## Mobil (Expo)
`apps/mobile/app.json` → `extra.apiOrigin` canlı adres; EAS build ile TestFlight/APK. Derin link
şeması `evidex://` (GitHub callback mobil dönüşü API tarafında).
