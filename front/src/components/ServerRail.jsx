/*
 * Rail des SERVEURS (PURE) — comme le vrai Discord : pastilles serveurs à gauche, icône réelle
 * (CDN) ou initiale. `guilds` = [{ guild_id, name, icon }]. Clic → onSelect(guild_id).
 * ⚠️ Remplace l'ancien BotRail (les bots ne vivent PAS ici : l'identité d'envoi = header).
 */
import { Avatar } from "./Avatar.jsx";
import { guildIconUrl } from "../lib/cdn.js";

export function ServerRail({ guilds = [], activeId = null, onSelect }) {
  return (
    <nav className="flex w-[72px] flex-col items-center gap-2 bg-base-900 py-3" aria-label="Serveurs">
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
