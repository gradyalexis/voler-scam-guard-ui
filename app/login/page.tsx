import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  denied: 'Login dibatalkan di halaman Discord.',
  invalid_request: 'Parameter callback tidak lengkap. Coba login ulang.',
  bad_state: 'State OAuth tidak cocok. Coba login ulang dari halaman ini.',
  expired: 'Sesi Discord kamu sudah kedaluwarsa. Login ulang untuk memuat daftar server.',
  server_error: 'Terjadi error di server saat memproses login. Cek log dashboard.',
  not_allowed:
    'Akun Discord ini bukan pemilik bot. Hanya user ID di BOT_OWNER_IDS (.env dashboard) yang bisa login.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await getSession();
  // Sesi `expired` masih punya cookie valid, tapi token Discord-nya tidak — jangan redirect balik.
  if (session && !error) redirect('/');

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-brand-500/15 text-2xl">
          🛡️
        </span>
        <h1 className="mt-4 text-lg font-semibold text-white">Voler Scam Guard</h1>
        <p className="mt-1 text-sm text-ink-400">
          Dashboard untuk pemilik instance bot ini. Masuk dengan akun Discord yang terdaftar di
          BOT_OWNER_IDS.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-danger-500/15 px-3 py-2 text-sm text-danger-500">
            {ERRORS[error] ?? 'Login gagal.'}
          </p>
        )}

        <a
          href="/api/auth/login"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-400"
        >
          Masuk dengan Discord
        </a>

        <p className="mt-4 text-xs text-ink-400">
          Dashboard hanya membaca profil dan daftar server kamu.
        </p>
      </div>
    </div>
  );
}
