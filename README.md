# Voler Scam Guard — Dashboard

Dashboard admin untuk bot anti-scam Discord **voler-scam-guard**. Moderator
memakai dashboard ini untuk melihat log deteksi, mengelola blacklist &
whitelist, dan mengatur perilaku bot per server.

Dashboard dan bot tidak saling memanggil: keduanya membaca/menulis database
Postgres (Supabase) yang sama. Skema, migrasi, RLS, dan backup database diurus
di repo bot.

```
Browser  ──▶  :9001  dashboard (Next.js, repo ini)      ──┐
                                                           ├──▶  PostgreSQL (Supabase)
Discord  ──▶  bot (repo voler-scam-guard, health :9000)  ──┘      skema & migrasi: repo bot
```

## Fitur

- Login Discord OAuth (scope `identify guilds`), khusus `BOT_OWNER_IDS`.
- **Server saya**: daftar server tempat user owner / Administrator / Manage
  Server, dengan status bot dan tombol **Pasang bot** yang langsung terkunci ke
  server itu.
- Per server (`/servers/<id>`): ringkasan, log deteksi, whitelist khusus server,
  dan setting bot. Data server lain tidak pernah terlihat.
- Ringkasan dan log global, blacklist domain & rekening/akun (approve/reject
  laporan), whitelist global, dan akses ke semua server tempat bot berada.
- **Hanya pemilik bot yang bisa login**: Discord user ID di `BOT_OWNER_IDS`.
  Akun lain ditolak di callback OAuth, dan menghapus ID dari `.env` langsung
  mencabut sesi yang sedang aktif.

## Prasyarat

- VPS dengan Docker + Docker Compose
- Domain yang A record-nya sudah mengarah ke IP VPS
- Database yang sudah disiapkan repo bot (`./scripts/migrate.sh` sudah
  dijalankan di sana, termasuk `005_multi_server.sql`) — dashboard tidak membuat
  atau mengubah tabel
- Aplikasi Discord yang sama dengan bot (Client ID + Client Secret)

## Setup Discord OAuth

1. Buka <https://discord.com/developers/applications> → aplikasi bot.
2. **General Information** → Application ID → `DISCORD_CLIENT_ID`.
3. **OAuth2** → Client Secret → `DISCORD_CLIENT_SECRET`.
4. **OAuth2 → Redirects** → tambahkan **dua** URL (harus sama persis dengan
   `DASHBOARD_URL` + path-nya):
   - `http://<host>:9001/api/auth/callback` — login
   - `http://<host>:9001/api/install/callback` — pasang bot
5. **Bot** → aktifkan **Requires OAuth2 Code Grant**. Dengan ini bot baru masuk
   ke server setelah dashboard menukar `code` di `/api/install/callback`, jadi
   link invite biasa tidak bisa dipakai lagi — semua pemasangan lewat dashboard
   dan tercatat di tabel `guild_installs`. Biarkan **Public Bot** tetap aktif;
   kalau dimatikan hanya pemilik aplikasi yang bisa memasang bot.
6. **Installation** → Install Link → pilih **None** (atau Custom URL ke
   `http://<host>:9001/`), supaya tombol "Add App" di profil bot tidak
   menawarkan link yang pasti gagal.

Login meminta scope `identify guilds`. Pasang bot memakai scope
`bot applications.commands` dengan permission 93184 (View Channels, Send
Messages, Manage Messages, Embed Links, Read Message History).

## Setup database

- `DATABASE_URL`: connection string **Session pooler** Supabase, sama dengan
  yang dipakai bot.
- `DATABASE_SSL_CA_FILE`: CA cert Supabase (**Project Settings → Database → SSL
  Configuration → Download certificate**), simpan sebagai
  `certs/supabase-ca.crt` — file yang sama dengan di repo bot. Koneksi selalu
  memverifikasi sertifikat server; untuk host Supabase tanpa CA, query pertama
  ke database gagal dengan pesan yang jelas alih-alih konek tanpa TLS.
- `DASHBOARD_DB_POOL_MAX` (default 3) ditambah `BOT_DB_POOL_MAX` di repo bot
  harus di bawah **Pool Size** pooler Supabase.

Dashboard konek sebagai `postgres`, pemilik tabel, jadi tidak terkena RLS yang
dipasang repo bot untuk menutup Data API Supabase.

## Deploy

```bash
git clone <repo> /opt/voler-scam-guard-dashboard && cd /opt/voler-scam-guard-dashboard

cp .env.example .env
openssl rand -base64 48          # tempel hasilnya ke AUTH_SECRET
nano .env                        # isi DATABASE_URL, Discord OAuth, DASHBOARD_URL, bootstrap admin
# simpan CA cert Supabase ke certs/supabase-ca.crt

docker compose up -d --build
docker compose logs -f dashboard
```

Dashboard dilayani langsung di **port 9001** tanpa TLS. Buka
`http://<host>:9001` dan login dengan akun Discord yang ID-nya kamu isi di
`BOT_OWNER_IDS`. `DASHBOARD_URL`
harus sama persis dengan URL itu, karena dipakai untuk redirect OAuth sekaligus
menentukan flag `Secure` cookie sesi.

**HTTPS**: port 9001 polos hanya aman untuk localhost/LAN atau di belakang
reverse proxy. Untuk domain publik, taruh proxy TLS di depannya (atau
kembalikan service `caddy` — `caddy/Caddyfile` masih ada di repo) lalu ubah
`DASHBOARD_URL` ke `https://…` dan perbarui redirect URI di Discord.

**Satu VPS dengan bot**: kedua repo punya compose project sendiri dan tidak
bentrok — bot hanya mempublish health di `127.0.0.1:9000` (Postgres lokalnya di
`127.0.0.1:5433`), dashboard memakai 9001.

## Development lokal

```bash
npm install
cp .env.example .env     # isi DATABASE_URL, DISCORD_*, AUTH_SECRET, BOT_OWNER_IDS
npm run dev              # http://localhost:3000
```

- `npm run dev` tetap di port 3000 (bukan 9001 — itu hanya port publikasi
  docker). Set `DASHBOARD_URL=http://localhost:3000` dan tambahkan redirect URI
  `http://localhost:3000/api/auth/callback` serta
  `http://localhost:3000/api/install/callback` di Discord OAuth2. Redirect URI
  untuk 3000 dan 9001 boleh didaftarkan bersamaan di Discord.
- Memakai Postgres lokal dari repo bot (`docker compose up -d postgres` di sana):
  set `DATABASE_URL=postgres://vsg:<password>@localhost:5433/voler_scam_guard`
  dan kosongkan `DATABASE_SSL_CA_FILE`.

Perintah lain:

```bash
npm run typecheck     # tsc --noEmit
npm run build         # build produksi (output standalone)
npm run sync:schema   # salin ulang skema & opsi koneksi dari repo bot
```

## Skema database

`lib/db/schema.ts` (skema Drizzle) dan `lib/db/connection.ts` (opsi koneksi +
SSL) adalah **salinan** dari `bot/src/db/` di repo bot. Jangan ubah langsung di
sini; jalankan:

```bash
npm run sync:schema                                        # repo bot di ../voler-scam-guard
BOT_REPO_DIR=/path/ke/voler-scam-guard npm run sync:schema # lokasi lain
```

Alur mengubah kolom:

1. Repo bot: tulis migrasi baru di `db/init/`, jalankan `./scripts/migrate.sh`,
   ubah `bot/src/db/schema.ts`.
2. Repo ini: `npm run sync:schema`, sesuaikan query di `lib/queries.ts` dan
   halaman terkait, `npm run typecheck`.
3. Commit hasil sync di repo ini, supaya build Docker tidak butuh repo bot.

## Keamanan

- Semua route kecuali `/login` dan `/api/auth/*` wajib sesi (`middleware.ts`).
  Sesi berupa JWT HS256 di cookie httpOnly `vsg_session` (maksimal 7 hari,
  tidak lebih lama dari access token Discord) yang ditandatangani `AUTH_SECRET`;
  mengganti `AUTH_SECRET` membuat semua sesi logout. `AUTH_SECRET` wajib minimal
  32 karakter; dashboard menolak start (`instrumentation.ts`) kalau lebih pendek,
  karena secret yang bisa ditebak memungkinkan sesi pemilik dipalsukan.
- JWT hanya berisi identitas. `middleware.ts` dan `getSession` memeriksa ulang
  `BOT_OWNER_IDS` setiap request.
- **Akses per server** (`lib/guilds.ts` → `requireGuildAccess`): dipanggil di
  setiap page dan server action yang menerima `guildId`. User biasa hanya boleh
  server yang ada di `dashboard_user_guilds` (owner / Administrator / Manage
  Server menurut Discord); pemilik bot boleh semua server. Query per server selalu
  memakai `guildId` dari URL yang sudah dicek, bukan dari query string.
- Daftar server disegarkan dari Discord paling lama tiap 5 menit memakai access
  token user (scope `identify guilds`) yang disimpan terenkripsi AES-256-GCM
  (kunci diturunkan dari `AUTH_SECRET`). Izin yang dicabut di Discord berlaku
  di dashboard setelah jeda itu. Token dihapus saat logout; kalau token
  kedaluwarsa atau dicabut, user diminta login ulang.
- Halaman global (blacklist, whitelist global, log global) dan semua aksinya
  butuh sesi pemilik.
- Pasang bot memakai `state` di cookie (anti-CSRF) dan hanya bisa dimulai untuk
  server yang boleh dikelola user.
- `DATABASE_URL` memakai kredensial pemilik tabel — hanya dipakai di server.
  Jangan pernah menaruh rahasia di variabel `NEXT_PUBLIC_*`, karena nilainya
  ikut terkirim ke browser.
- Next mengirim `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: same-origin`, dan `X-Robots-Tag: noindex, nofollow`
  (`next.config.ts`; dulu dipasang Caddy).
- Cookie sesi memakai `Secure` hanya kalau `DASHBOARD_URL` berskema `https`,
  supaya login tidak diam-diam gagal saat dilayani di HTTP port 9001.

## Struktur project

```
voler-scam-guard-dashboard/
├── docker-compose.yml      # dashboard, publish :9001
├── Dockerfile              # build Next.js standalone
├── .env.example
├── caddy/Caddyfile         # opsional: reverse proxy + auto HTTPS (tidak dipakai)
├── certs/                  # CA cert Supabase (supabase-ca.crt)
├── scripts/sync-schema.sh  # salin skema & opsi koneksi dari repo bot
├── app/
│   ├── page.tsx            # Server saya: pilih server, pasang bot
│   ├── servers/[guildId]/  # ringkasan, logs, whitelist, settings per server
│   ├── overview, logs, blacklist, whitelist/           # halaman global
│   └── api/auth, api/install/                          # login & pasang bot (OAuth2)
├── components/             # Shell, Nav, GuildShell, LogsView, primitives
├── lib/
│   ├── auth.ts             # Discord OAuth + sesi JWT
│   ├── owner.ts            # BOT_OWNER_IDS + validasi AUTH_SECRET (dipakai middleware)
│   ├── guilds.ts           # daftar server user + requireGuildAccess
│   ├── crypto.ts           # enkripsi access token Discord
│   ├── queries.ts          # query untuk halaman
│   ├── normalize.ts        # normalisasi domain & identifier
│   └── db/                 # pool pg; schema.ts & connection.ts = salinan repo bot
└── middleware.ts           # proteksi semua route non-publik
```

## Catatan

- Bot meng-cache blacklist/whitelist 60 detik dan setting per server 30 detik,
  jadi perubahan dari dashboard berlaku di bot maksimal setelah jeda itu.
- Setelah upgrade ke versi multi-server, sesi lama diminta login ulang sekali
  (Discord menampilkan persetujuan scope `guilds` yang baru).
