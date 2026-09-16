#!/usr/bin/env bash
# lib/db/schema.ts (skema Drizzle) dan lib/db/connection.ts (opsi koneksi DB)
# adalah salinan dari repo bot, pemilik skema dan migrasi database. Skrip ini
# menyalin ulang keduanya dari working copy repo bot:
#   ./scripts/sync-schema.sh                                  # repo bot di ../voler-scam-guard
#   BOT_REPO_DIR=/path/ke/voler-scam-guard ./scripts/sync-schema.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOT_REPO_DIR="${BOT_REPO_DIR:-$ROOT_DIR/../voler-scam-guard}"
SRC_DIR="$BOT_REPO_DIR/bot/src/db"

if [ ! -f "$SRC_DIR/schema.ts" ] || [ ! -f "$SRC_DIR/connection.ts" ]; then
  echo "Repo bot tidak ditemukan di $BOT_REPO_DIR (set BOT_REPO_DIR)." >&2
  exit 1
fi

for name in schema connection; do
  # Import lokal di bot memakai sufiks .js (ESM NodeNext); Next.js tidak.
  sed -e "s#^// File ini juga disalin ke repo voler-scam-guard-dashboard (lib/db/$name.ts).\$#// Salinan dari voler-scam-guard/bot/src/db/$name.ts — JANGAN diubah di sini.#" \
      -e "s#^// Kalau diubah, jalankan \`npm run sync:schema\` di repo dashboard.\$#// Ubah di repo bot, lalu jalankan \`npm run sync:schema\` di repo ini.#" \
      -e "s#from '\(\./[^']*\)\.js'#from '\1'#" \
      "$SRC_DIR/$name.ts" > "$ROOT_DIR/lib/db/$name.ts"
  echo "lib/db/$name.ts disalin dari repo bot"
done

echo "Ingat: perubahan kolom ditulis sebagai migrasi di repo bot (db/init/) dan dijalankan dengan ./scripts/migrate.sh di sana."
