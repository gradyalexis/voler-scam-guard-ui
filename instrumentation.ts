import { authSecret, ownerIds } from './lib/owner';

/**
 * Dijalankan Next.js sekali saat server start: gagal cepat kalau konfigurasi
 * akses tidak aman. Next hanya mencatat error dari hook ini lalu tetap melayani
 * request (semuanya 500), jadi proses dihentikan sendiri supaya container
 * berhenti dengan pesan yang jelas di log.
 */
export function register() {
  try {
    authSecret();
    if (ownerIds().length === 0) {
      throw new Error('BOT_OWNER_IDS wajib berisi minimal satu Discord user ID — hanya ID ini yang bisa login');
    }
  } catch (err) {
    console.error(`[config] ${err instanceof Error ? err.message : String(err)}`);
    if (process.env.NEXT_RUNTIME === 'nodejs') process.exit(1);
    throw err;
  }
}
