/*
 * Panneau contextuel opérateur (PURE) — fiche du correspondant/conversation actif (PLAN §8 : pas une déco).
 * `subject` = { name, kind, user_id?, channelId?, avatarUrl?, member? } ou null.
 * `member` = identité annuaire { username, global_name, is_bot, public_flags, banner, accent_color,
 *            tag, tag_badge, tag_guild_id } (résolue par le parent ; profil enrichi REST côté relais).
 * Bannière : image CDN si hash, sinon aplat accent_color, sinon gris. Badges = decodeBadges(public_flags).
 * Date de création = DÉRIVÉE du snowflake (zéro appel API). ⚠️ La BIO n'est PAS affichable :
 * l'API Discord ne l'expose pas aux bots pour les autres utilisateurs (limitation plateforme).
 */
import { Avatar } from "./Avatar.jsx";
import { snowflakeToDate } from "../lib/snowflake.js";
import { decodeBadges } from "../lib/badges.js";
import { userBannerUrl, clanBadgeUrl, badgeIconUrl } from "../lib/cdn.js";

const fmtDate = (d) =>
  d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;

const accentHex = (c) => (typeof c === "number" ? `#${c.toString(16).padStart(6, "0")}` : null);

export function DetailsPanel({ subject = null }) {
  const member = subject?.member ?? null;
  const isDM = subject?.kind === "dm";
  // user (DM) ou salon : les deux IDs sont des snowflakes → date de création gratuite.
  const snowflake = subject ? (isDM ? subject.user_id : (subject.channelId ?? subject.id)) : null;
  const created = fmtDate(snowflakeToDate(snowflake));
  const badges = decodeBadges(member?.public_flags);
  const bannerUrl = isDM ? userBannerUrl(subject?.user_id, member?.banner) : null;
  const tagBadgeUrl = clanBadgeUrl(member?.tag_guild_id, member?.tag_badge);

  return (
    <aside className="hidden w-72 flex-col bg-base-800 lg:flex" aria-label="Détails">
      <header className="px-4 py-3 text-sm font-semibold text-text-normal shadow">Détails</header>
      {!subject ? (
        <div className="flex-1 px-4 py-4 text-sm">
          <p className="text-text-muted">Sélectionne une conversation</p>
        </div>
      ) : (
        <div className="flex-1 text-sm">
          {/* Bannière profil (DM) : image CDN > aplat accent_color > gris neutre. */}
          {isDM ? (
            bannerUrl ? (
              <img src={bannerUrl} alt="" className="h-24 w-full object-cover" />
            ) : (
              <div className="h-24 w-full" style={{ backgroundColor: accentHex(member?.accent_color) ?? "#1e1f22" }} />
            )
          ) : null}
          <div className="space-y-3 px-4 py-4">
            <div className="flex items-center gap-3">
              <Avatar src={subject.avatarUrl ?? null} name={subject.name} className="h-12 w-12 rounded-full text-lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-text-normal">{subject.name}</span>
                  {member?.tag ? (
                    <span className="flex items-center gap-0.5 rounded bg-base-900 px-1 py-px text-[10px] font-semibold text-text-normal">
                      {tagBadgeUrl ? <img src={tagBadgeUrl} alt="" className="h-3 w-3" /> : null}
                      {member.tag}
                    </span>
                  ) : null}
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
            {/* Badges = icônes OFFICIELLES CDN (tooltip = nom au survol, comme le vrai Discord).
                Badge sans icône connue (verified_bot) → chip texte, jamais d'img cassée. */}
            {badges.length ? (
              <div className="flex flex-wrap items-center gap-1 rounded bg-base-900 px-1.5 py-1">
                {badges.map((b) =>
                  b.icon ? (
                    <img key={b.key} src={badgeIconUrl(b.icon)} alt={b.label} title={b.label} className="h-5 w-5" />
                  ) : (
                    <span key={b.key} className="rounded px-1 text-[10px] text-text-normal" title={b.label}>
                      {b.label}
                    </span>
                  )
                )}
              </div>
            ) : null}
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
        </div>
      )}
    </aside>
  );
}
