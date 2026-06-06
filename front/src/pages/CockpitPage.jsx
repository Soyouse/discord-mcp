import { useState } from "react";
import { BotRail } from "../components/BotRail.jsx";
import { ConversationList } from "../components/ConversationList.jsx";
import { MessageList } from "../components/MessageList.jsx";
import { Composer } from "../components/Composer.jsx";
import { DetailsPanel } from "../components/DetailsPanel.jsx";
import { useGuilds, useChannels, useDMables, useHistory, useSendMessage, useOpenDM } from "../api/hooks.js";
import { useChannelRealtime } from "../realtime/useChannelRealtime.js";

// Rail bots : pas d'endpoint /api/bots (un seul bot aujourd'hui) → constante. P6 = liste dynamique.
const BOTS = [{ id: "echidna", name: "Echidna" }];

/*
 * Cockpit (P5d) — données réelles + TEMPS RÉEL + envoi optimiste.
 * ⚠️ `active.channelId` = cible d'envoi/d'historique. Salon : connu direct. DM : résolu via openDM au clic.
 * ⚠️ Envoi = optimiste (apparaît tout de suite) ; l'écho socket dédupe par message_id (reconcile).
 * `socket` absent (tests) → pas de temps réel, le reste fonctionne.
 */
export function CockpitPage({ socket } = {}) {
  const [activeBot, setActiveBot] = useState(BOTS[0].id);
  const [active, setActive] = useState(null); // { id, name, kind, user_id?, channelId? }

  const { data: guilds = [] } = useGuilds();
  const guildId = guilds[0]?.guild_id ?? null;
  const { data: channels = [] } = useChannels(guildId);
  const { data: dmables = [] } = useDMables();

  const channelId = active?.channelId ?? null;
  const { data: messages = [] } = useHistory(channelId);
  const sendMsg = useSendMessage();
  const openDM = useOpenDM();
  useChannelRealtime(socket, channelId);

  const conversations = [
    ...channels.map((c) => ({ id: c.channel_id, name: c.name, kind: "channel", channelId: c.channel_id })),
    ...dmables.map((d) => ({ id: d.user_id, name: d.global_name || d.username, kind: "dm", user_id: d.user_id })),
  ];

  function handleSelect(item) {
    if (item.kind === "channel") {
      setActive(item); // channelId déjà présent
      return;
    }
    // DM : ouvrir (ou récupérer) le canal puis activer avec le channelId réel.
    openDM.mutate(
      { recipientId: item.user_id, bot: activeBot },
      { onSuccess: ({ channel_id }) => setActive({ ...item, channelId: channel_id }) }
    );
  }

  function handleSend(text) {
    if (!channelId) return;
    sendMsg.mutate({
      channelId,
      content: text,
      bot: activeBot,
      nonce: crypto.randomUUID(),
      author: "Echidna",
      authorId: activeBot,
    });
  }

  return (
    <div className="flex h-full">
      <BotRail bots={BOTS} activeId={activeBot} onSelect={setActiveBot} />
      <ConversationList items={conversations} activeId={active?.id ?? null} onSelect={handleSelect} />

      <main className="flex flex-1 flex-col bg-base-700">
        <header className="px-4 py-3 text-sm font-semibold text-text-normal shadow">
          {active ? `${active.kind === "dm" ? "@" : "#"} ${active.name}` : "Sélectionne une conversation"}
        </header>
        <MessageList messages={messages} />
        <Composer onSend={handleSend} disabled={!channelId} />
      </main>

      <DetailsPanel subject={active} />
    </div>
  );
}
