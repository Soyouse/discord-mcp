import { useState } from "react";
import { BotRail } from "../components/BotRail.jsx";
import { ConversationList } from "../components/ConversationList.jsx";
import { MessageList } from "../components/MessageList.jsx";
import { Composer } from "../components/Composer.jsx";
import { DetailsPanel } from "../components/DetailsPanel.jsx";
import { useGuilds, useChannels, useDMables, useHistory, useSendMessage } from "../api/hooks.js";

// Rail bots : pas d'endpoint /api/bots (un seul bot aujourd'hui) → constante. P6 = liste dynamique.
const BOTS = [{ id: "echidna", name: "Echidna" }];

/*
 * Cockpit (P5c) — données RÉELLES via hooks react-query (mock MSW en dev/tests, vraie API en prod).
 * ⚠️ Conversations = salons (historique chargé) + DMables. L'ouverture/envoi DM (dépend de openDM) = P5d.
 * ⚠️ Envoi salon = mutation → invalidation historique (refetch). Optimiste + écho socket = P5d.
 */
export function CockpitPage() {
  const [activeBot, setActiveBot] = useState(BOTS[0].id);
  const [active, setActive] = useState(null); // conversation sélectionnée

  const { data: guilds = [] } = useGuilds();
  const guildId = guilds[0]?.guild_id ?? null;
  const { data: channels = [] } = useChannels(guildId);
  const { data: dmables = [] } = useDMables();

  const isChannel = active?.kind === "channel";
  const { data: messages = [] } = useHistory(isChannel ? active.id : null);
  const sendMsg = useSendMessage();

  const conversations = [
    ...channels.map((c) => ({ id: c.channel_id, name: c.name, kind: "channel" })),
    ...dmables.map((d) => ({ id: d.user_id, name: d.global_name || d.username, kind: "dm", user_id: d.user_id })),
  ];

  function handleSend(text) {
    if (!isChannel) return; // envoi DM = P5d (nécessite openDM)
    sendMsg.mutate({ channelId: active.id, content: text, bot: activeBot });
  }

  return (
    <div className="flex h-full">
      <BotRail bots={BOTS} activeId={activeBot} onSelect={setActiveBot} />
      <ConversationList items={conversations} activeId={active?.id ?? null} onSelect={setActive} />

      <main className="flex flex-1 flex-col bg-base-700">
        <header className="px-4 py-3 text-sm font-semibold text-text-normal shadow">
          {active ? `${active.kind === "dm" ? "@" : "#"} ${active.name}` : "Sélectionne une conversation"}
        </header>
        <MessageList messages={messages} />
        <Composer
          onSend={handleSend}
          disabled={!isChannel}
          placeholder={active && !isChannel ? "Envoi DM bientôt (P5d)" : "Envoyer un message"}
        />
      </main>

      <DetailsPanel subject={active} />
    </div>
  );
}
