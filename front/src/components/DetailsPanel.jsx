/*
 * Panneau contextuel opérateur (PURE) — fiche du correspondant/conversation actif (PLAN §8 : pas une déco).
 * `subject` = { name, kind, user_id?, channelId?, avatarUrl?, member? } ou null.
 * `member` = identité annuaire { username, global_name, is_bot } (résolue par le parent).
 * Date de création = DÉRIVÉE du snowflake (zéro appel API). ⚠️ La BIO n'est PAS affichable :
 * l'API Discord ne l'expose pas aux bots pour les autres utilisateurs (limitation plateforme).
 */
import { Avatar } from "./Avatar.jsx";
import { snowflakeToDate } from "../lib/snowflake.js";

const fmtDate = (d) =>
  d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;

export function DetailsPanel({ subject = null }) {
  const member = subject?.member ?? null;
  const isDM = subject?.kind === "dm";
  // user (DM) ou salon : les deux IDs sont des snowflakes → date de création gratuite.
  const snowflake = subject ? (isDM ? subject.user_id : (subject.channelId ?? subject.id)) : null;
  const created = fmtDate(snowflakeToDate(snowflake));

  return (
    <aside className="hidden w-72 flex-col bg-base-800 lg:flex" aria-label="Détails">
      <header className="px-4 py-3 text-sm font-semibold text-text-normal shadow">Détails</header>
      <div className="flex-1 px-4 py-4 text-sm">
        {!subject ? (
          <p className="text-text-muted">Sélectionne une conversation</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar src={subject.avatarUrl ?? null} name={subject.name} className="h-12 w-12 rounded-full text-lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-text-normal">{subject.name}</span>
                  {member?.is_bot ? (
                    <span className="rounded bg-blurple px-1 py-px text-[10px] font-semibold uppercase text-white">
                      bot
                    </span>
                  ) : null}
                </div>
                {member?.username ? <div className="truncate text-xs text-text-muted">@{member.username}</div> : null}
                <div className="text-xs text-text-muted">{isDM ? "Message privé" : "Salon"}</div>
              </div>
            </div>
            {created ? (
              <div className="text-xs text-text-muted">
                {isDM ? "Compte créé le" : "Créé le"}{" "}
                <span className="text-text-normal">{created}</span>
              </div>
            ) : null}
            {subject.user_id ? (
              <div className="text-xs text-text-muted">
                ID <span className="font-mono text-text-normal">{subject.user_id}</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
