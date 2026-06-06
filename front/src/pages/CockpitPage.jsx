import { useState } from "react";
import { BotRail } from "../components/BotRail.jsx";
import { ConversationList } from "../components/ConversationList.jsx";
import { MessageList } from "../components/MessageList.jsx";
import { Composer } from "../components/Composer.jsx";
import { DetailsPanel } from "../components/DetailsPanel.jsx";
import { FIXTURE_BOTS, FIXTURE_CONVERSATIONS, FIXTURE_MESSAGES } from "../fixtures.js";

/*
 * Cockpit (P5b) — assemble les composants présentationnels + sélection locale.
 * ⚠️ Données = FIXTURES (remplacées par hooks react-query en P5c). L'envoi append LOCALEMENT
 *    (démo) ; le vrai envoi (POST API) + réconciliation optimiste = P5d.
 */
export function CockpitPage() {
  const [activeBot, setActiveBot] = useState(FIXTURE_BOTS[0]?.id ?? null);
  const [active, setActive] = useState(null); // conversation sélectionnée
  const [messages, setMessages] = useState(FIXTURE_MESSAGES);

  const current = active ? messages[active.id] ?? [] : [];

  function handleSend(text) {
    if (!active) return;
    // ⚠️ DÉMO P5b : append local. P5d remplacera par POST /api + écho socket (dédupe message_id).
    const msg = {
      message_id: `local-${current.length + 1}`,
      channel_id: active.id,
      author_id: activeBot,
      author: "Echidna",
      content: text,
      created_at: new Date().toISOString(),
      edited_at: null,
    };
    setMessages((m) => ({ ...m, [active.id]: [...(m[active.id] ?? []), msg] }));
  }

  return (
    <div className="flex h-full">
      <BotRail bots={FIXTURE_BOTS} activeId={activeBot} onSelect={setActiveBot} />
      <ConversationList items={FIXTURE_CONVERSATIONS} activeId={active?.id ?? null} onSelect={setActive} />

      <main className="flex flex-1 flex-col bg-base-700">
        <header className="px-4 py-3 text-sm font-semibold text-text-normal shadow">
          {active ? `${active.kind === "dm" ? "@" : "#"} ${active.name}` : "Sélectionne une conversation"}
        </header>
        <MessageList messages={current} />
        <Composer onSend={handleSend} disabled={!active} />
      </main>

      <DetailsPanel subject={active} />
    </div>
  );
}
