/*
 * Rail des SERVEURS (PURE) — comme le vrai Discord : bouton HOME (Messages privés) en haut,
 * séparateur, puis pastilles serveurs (icône CDN ou initiale). Clic serveur → onSelect(guild_id) ;
 * clic home → onHome(). `homeActive` = la vue MP est affichée.
 * ⚠️ Remplace l'ancien BotRail (les bots ne vivent PAS ici : l'identité d'envoi = header).
 */
import { Avatar } from "./Avatar.jsx";
import { guildIconUrl } from "../lib/cdn.js";

export function ServerRail({ guilds = [], activeId = null, homeActive = false, onSelect, onHome }) {
  return (
    <nav className="flex w-[72px] flex-col items-center gap-2 bg-base-900 py-3" aria-label="Serveurs">
      <button
        type="button"
        onClick={() => onHome?.()}
        title="Messages privés"
        aria-current={homeActive ? "true" : undefined}
        className={`grid h-12 w-12 place-items-center text-xl text-white transition-all ${
          homeActive ? "rounded-2xl bg-blurple" : "rounded-full bg-base-700 hover:rounded-2xl hover:bg-blurple"
        }`}
      >
        💬
      </button>
      <span className="h-px w-8 shrink-0 rounded bg-base-600" />
      {guilds.map((g) => {
        const active = g.guild_id === activeId;
        return (
          <button
            key={g.guild_id}
            type="button"
            onClick={() => onSelect?.(g.guild_id)}
            title={g.name}
            aria-current={active ? "true" : undefined}
            className={`overflow-hidden transition-all ${
              active ? "rounded-2xl ring-2 ring-blurple" : "rounded-full hover:rounded-2xl"
            }`}
          >
            <Avatar
              src={guildIconUrl(g.guild_id, g.icon)}
              name={g.name}
              className={`h-12 w-12 text-white ${active ? "rounded-2xl bg-blurple" : "rounded-full bg-base-700 hover:rounded-2xl"}`}
            />
          </button>
        );
      })}
    </nav>
  );
}
