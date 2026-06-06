/*
 * Page de login (P5a = placeholder visuel). Le flux réel = "Login with Discord" (OAuth → JWT),
 * branché en P2b quand l'app OAuth Discord sera enregistrée. Ici : juste l'écran + bouton.
 */
export function LoginPage() {
  return (
    <div className="flex h-full items-center justify-center bg-base-900">
      <div className="w-80 rounded-lg bg-base-800 p-8 text-center shadow-lg">
        <h1 className="mb-2 text-xl font-bold text-text-normal">Cockpit Discord</h1>
        <p className="mb-6 text-sm text-text-muted">
          Client alternatif piloté humain &amp; IA.
        </p>
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-md bg-blurple px-4 py-2 font-medium text-white opacity-60"
        >
          Se connecter avec Discord
        </button>
        <p className="mt-3 text-xs text-text-muted">OAuth bientôt disponible (P2b)</p>
      </div>
    </div>
  );
}
