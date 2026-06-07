import { startLogin } from "../api/auth.js";

/*
 * Page de login — bouton "Login with Discord" (P2b actif). Le clic = navigation pleine page vers
 * /api/auth/login (le backend redirige vers Discord). Affiche un message si retour en erreur (?error=).
 */
const ERRORS = {
  forbidden: "Ce compte Discord n'est pas autorisé à accéder au cockpit.",
  state: "Session de connexion expirée, réessaie.",
  login: "La connexion a échoué, réessaie.",
};

export function LoginPage() {
  const error = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("error") : null;
  return (
    <div className="flex h-full items-center justify-center bg-base-900">
      <div className="w-80 rounded-lg bg-base-800 p-8 text-center shadow-lg">
        <h1 className="mb-2 text-xl font-bold text-text-normal">Cockpit Discord</h1>
        <p className="mb-6 text-sm text-text-muted">Client alternatif piloté humain &amp; IA.</p>
        {error && (
          <p className="mb-4 rounded-md bg-status-dnd/15 px-3 py-2 text-xs text-status-dnd">
            {ERRORS[error] ?? "Erreur de connexion."}
          </p>
        )}
        <button
          type="button"
          onClick={startLogin}
          className="w-full rounded-md bg-blurple px-4 py-2 font-medium text-white transition hover:opacity-90"
        >
          Se connecter avec Discord
        </button>
      </div>
    </div>
  );
}
