import { useState } from "react";
import { ServerRail } from "../components/ServerRail.jsx";
import { ConversationList } from "../components/ConversationList.jsx";
import { MessageList } from "../components/MessageList.jsx";
import { Composer } from "../components/Composer.jsx";
import { DetailsPanel } from "../components/DetailsPanel.jsx";
import { UserPanel } from "../components/UserPanel.jsx";
import { useGuilds, useChannels, useDMables, useHistory, useSendMessage, useOpenDM } from "../api/hooks.js";
import { useChannelRealtime } from "../realtime/useChannelRealtime.js";
import { CommandPalette } from "../components/CommandPalette.jsx";
import { useCommandPalette } from "../components/useCommandPalette.js";
import { logout } from "../api/auth.js";
import { userAvatarUrl } from "../lib/cdn.js";

// Déconnexion : révoque côté serveur puis recharge sur /login (vide le token mémoire + relance useSession → anon).
async function doLogout() {
  try {
    await logout();
  } finally {
    window.location.href = "/login";
  }
}

// Bots : pas d'endpoint /api/bots (un seul bot aujourd'hui) → constante. L'identité d'envoi vit dans
// le HEADER (pas le rail gauche : à gauche = SERVEURS, comme le vrai Discord). Multi-bot = select futur.
const BOTS = [{ id: "echidna", name: "Echidna" }];

// Types de salons Discord affichables dans la liste : 0 = texte, 5 = annonces.
// ⚠️ Les CATÉGORIES (type 4) et salons vocaux (type 2) ne sont PAS des conversations cliquables —
//    les afficher comme salons était un bug UX vécu (« Salons textuels » cliquable, fil vide).
const TEXT_CHANNEL_TYPES = new Set([0, 5]);

/*
 * Cockpit (P5d) — données réelles + TEMPS RÉEL + envoi optimiste.
 * ⚠️ `active.channelId` = cible d'envoi/d'historique. Salon : connu direct. DM : résolu via openDM au clic.
 * ⚠️ Envoi = optimiste (apparaît tout de suite) ; l'écho socket dédupe par message_id (reconcile).
 * `socket` absent (tests) → pas de temps réel, le reste fonctionne.
 */
export function CockpitPage({ socket, user } = {}) {
  const [activeBot] = useState(BOTS[0].id);
  // Vue Discord-like : "home" = Messages privés (logo en haut du rail) | sinon un serveur.
  const [view, setView] = useState(null); // null = première guild chargée · "home" · guild_id
  const [active, setActive] = useState(null); // { id, name, kind, user_id?, channelId? }

  const { data: guilds = [] } = useGuilds();
  const isHome = view === "home";
  const guildId = isHome ? null : (view ?? guilds[0]?.guild_id ?? null);
  const { data: channels = [] } = useChannels(guildId);
  const { data: dmables = [] } = useDMables();

  const channelId = active?.channelId ?? null;
  const { data: messages = [], fetchNextPage, hasNextPage, isFetchingNextPage } = useHistory(channelId);
  const sendMsg = useSendMessage();
  const openDM = useOpenDM();
  useChannelRealtime(socket, channelId);
  const palette = useCommandPalette();

  const channelItems = channels
    .filter((c) => TEXT_CHANNEL_TYPES.has(c.type))
    .map((c) => ({ id: c.channel_id, name: c.name, kind: "channel", channelId: c.channel_id }));
  const dmItems = dmables.map((d) => ({
    id: d.user_id,
    name: d.global_name || d.username,
    kind: "dm",
    user_id: d.user_id,
    avatarUrl: userAvatarUrl(d.user_id, d.avatar),
  }));
  // Vue home = MP seuls ; vue serveur = ses salons seuls (Discord-like). La palette ⌘K voit TOUT.
  const conversations = isHome ? dmItems : channelItems;
  const allConversations = [...channelItems, ...dmItems];

  // Avatars des auteurs du fil (jointure front via l'annuaire DMables ; bots = initiale).
  const avatarsByUserId = Object.fromEntries(
    dmables.map((d) => [d.user_id, userAvatarUrl(d.user_id, d.avatar)]).filter(([, url]) => url)
  );

  function handleSelectGuild(id) {
    setView(id);
    setActive(null); // les salons changent de serveur → aucune conversation active
  }

  function handleHome() {
    setView("home");
    setActive(null);
  }

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

  const listTitle = isHome
    ? "Messages privés"
    : (guilds.find((g) => g.guild_id === guildId)?.name ?? "Conversations");

  return (
    <div className="flex h-full">
      <ServerRail
        guilds={guilds}
        activeId={isHome ? null : guildId}
        homeActive={isHome}
        onSelect={handleSelectGuild}
        onHome={handleHome}
      />
      <ConversationList
        items={conversations}
        activeId={active?.id ?? null}
        onSelect={handleSelect}
        title={listTitle}
        onSearch={() => palette.setOpen(true)}
        footer={<UserPanel user={user} avatarUrl={avatarsByUserId[user?.userId] ?? null} onLogout={doLogout} />}
      />

      <main className="flex flex-1 flex-col bg-base-700">
        <header className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-text-normal shadow">
          <span>{active ? `${active.kind === "dm" ? "@" : "#"} ${active.name}` : "Sélectionne une conversation"}</span>
          <span className="rounded bg-base-800 px-2 py-0.5 text-xs font-normal text-text-muted">
            bot : {BOTS.find((b) => b.id === activeBot)?.name}
          </span>
        </header>
        <MessageList
          messages={messages}
          avatarsByUserId={avatarsByUserId}
          onLoadOlder={fetchNextPage}
          hasMore={!!hasNextPage}
          isLoadingOlder={isFetchingNextPage}
        />
        <Composer onSend={handleSend} disabled={!channelId} />
      </main>

      <DetailsPanel subject={active} />

      <CommandPalette
        open={palette.open}
        onOpenChange={palette.setOpen}
        conversations={allConversations}
        onSelectConversation={(item) => {
          // La palette peut cibler un DM depuis une vue serveur → bascule la vue cohérente.
          if (item.kind === "dm") setView("home");
          handleSelect(item);
        }}
      />
    </div>
  );
}
