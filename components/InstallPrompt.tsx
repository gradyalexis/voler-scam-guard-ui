export function installHref(guildId: string): string {
  return `/api/install?guild=${guildId}`;
}

export function InstallPrompt({
  guildId,
  canInstall,
  wasInstalled,
  justInstalled,
}: {
  guildId: string;
  /** Hanya admin server itu (menurut Discord) yang bisa memasang bot. */
  canInstall: boolean;
  /** Bot pernah ada di server ini lalu dikeluarkan. */
  wasInstalled: boolean;
  justInstalled: boolean;
}) {
  if (justInstalled) {
    return (
      <div className="rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-sm text-ink-200">
        Bot sedang bergabung ke server ini. Biasanya butuh beberapa detik —{' '}
        <a href={`/servers/${guildId}`} className="text-brand-400 hover:underline">
          muat ulang halaman
        </a>
        .
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn-500/40 bg-warn-500/10 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-white">
          {wasInstalled ? 'Bot sudah dikeluarkan dari server ini' : 'Bot belum dipasang di server ini'}
        </p>
        <p className="text-xs text-ink-400">
          {wasInstalled
            ? 'Setting lama tetap tersimpan dan berlaku lagi begitu bot dipasang ulang.'
            : 'Pasang bot dulu supaya pesan di server ini mulai dipindai.'}
        </p>
      </div>
      {canInstall ? (
        <a
          href={installHref(guildId)}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-400"
        >
          Pasang bot
        </a>
      ) : (
        <span className="text-xs text-ink-400">Butuh izin Manage Server untuk memasang bot.</span>
      )}
    </div>
  );
}
