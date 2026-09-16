/**
 * Konfigurasi akses yang dibaca middleware (edge runtime) maupun server, jadi
 * file ini tidak boleh mengimpor database atau modul Node.
 *
 * Dashboard ini dipakai oleh pemilik instance bot saja: yang boleh login hanya
 * Discord user ID di BOT_OWNER_IDS. Menghapus ID dari .env langsung mencabut
 * aksesnya, termasuk sesi yang sedang aktif.
 */

export const MIN_AUTH_SECRET_LENGTH = 32;

export function ownerIds(): string[] {
  return (process.env.BOT_OWNER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d{15,25}$/.test(s));
}

export function isOwner(discordId: string): boolean {
  return ownerIds().includes(discordId);
}

/**
 * Kunci penandatangan cookie sesi dan enkripsi token Discord. Secret pendek
 * bisa ditebak, dan siapa pun yang menebaknya bisa memalsukan sesi pemilik.
 */
export function authSecret(): string {
  const secret = process.env.AUTH_SECRET ?? '';
  if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SECRET wajib diisi minimal ${MIN_AUTH_SECRET_LENGTH} karakter — buat dengan: openssl rand -base64 48`,
    );
  }
  return secret;
}
