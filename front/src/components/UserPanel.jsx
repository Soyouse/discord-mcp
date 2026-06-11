/*
 * Panneau utilisateur (PURE) — bas de la sidebar, comme le vrai Discord : avatar + pseudo + déconnexion.
 * `user` = { userId, username } (principal OAuth) ; `avatarUrl` résolu par le parent (annuaire).
 */
import { Avatar } from "./Avatar.jsx";

export function UserPanel({ user = null, avatarUrl = null, onLogout }) {
  if (!user) return null;
  return (
    <div className="flex items-center gap-2 bg-base-900/60 px-2 py-2">
      <Avatar src={avatarUrl} name={user.username ?? "?"} className="h-8 w-8 rounded-full text-xs" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text-normal">{user.username}</div>
        <div className="text-[11px] text-text-muted">En ligne</div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        title="Se déconnecter"
        aria-label="Se déconnecter"
        className="rounded px-2 py-1 text-xs text-text-muted hover:bg-base-600 hover:text-text-normal"
      >
        ⏻
      </button>
    </div>
  );
}
