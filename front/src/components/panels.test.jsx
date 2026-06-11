import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailsPanel } from "./DetailsPanel.jsx";
import { MessageList } from "./MessageList.jsx";

describe("DetailsPanel", () => {
  it("sans sujet → invite à sélectionner", () => {
    render(<DetailsPanel subject={null} />);
    expect(screen.getByText("Sélectionne une conversation")).toBeInTheDocument();
  });

  it("DM → nom + libellé 'Message privé' + ID", () => {
    render(<DetailsPanel subject={{ name: "soyouse", kind: "dm", user_id: "999" }} />);
    expect(screen.getByText("soyouse")).toBeInTheDocument();
    expect(screen.getByText("Message privé")).toBeInTheDocument();
    expect(screen.getByText("999")).toBeInTheDocument();
  });

  it("DM avec member → @username + badge BOT + date de création (snowflake)", () => {
    render(
      <DetailsPanel
        subject={{
          name: "Echidna",
          kind: "dm",
          user_id: "1506439277121241158", // snowflake réel → "Compte créé le" dérivé sans API
          member: { username: "Echidna", global_name: null, is_bot: true },
        }}
      />
    );
    expect(screen.getByText("@Echidna")).toBeInTheDocument();
    expect(screen.getByText("bot")).toBeInTheDocument();
    expect(screen.getByText("Compte créé le", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("DM humain (member non-bot) → PAS de badge BOT", () => {
    render(
      <DetailsPanel
        subject={{ name: "Théo", kind: "dm", user_id: "999", member: { username: "soyouse", is_bot: false } }}
      />
    );
    expect(screen.getByText("@soyouse")).toBeInTheDocument();
    expect(screen.queryByText("bot")).not.toBeInTheDocument();
  });

  it("profil enrichi → bannière (img CDN), badges (flags 64 → Bravery), tag serveur avec badge", () => {
    render(
      <DetailsPanel
        subject={{
          name: "Théo",
          kind: "dm",
          user_id: "111111111111111111",
          member: {
            username: "soyouse", is_bot: false, public_flags: 64, banner: "bh",
            accent_color: 1069668, tag: "2077", tag_badge: "tb", tag_guild_id: "428",
          },
        }}
      />
    );
    expect(screen.getByText("HypeSquad Bravery")).toBeInTheDocument();
    expect(screen.getByText("2077")).toBeInTheDocument();
    expect(document.querySelector('img[src*="/banners/111111111111111111/bh"]')).toBeTruthy();
    expect(document.querySelector('img[src*="/clan-badges/428/tb"]')).toBeTruthy();
  });

  it("sans bannière → aplat accent_color ; sans flags → aucune rangée badges", () => {
    render(
      <DetailsPanel
        subject={{ name: "waikoz", kind: "dm", user_id: "999", member: { username: "waikoz", is_bot: false, public_flags: 0, banner: null, accent_color: 2303016 } }}
      />
    );
    expect(document.querySelector('img[src*="/banners/"]')).toBeFalsy();
    expect(screen.queryByText(/HypeSquad|Staff|Supporter/)).not.toBeInTheDocument();
  });

  it("ID non-snowflake (mocks 'c1') → pas de date, pas de crash", () => {
    render(<DetailsPanel subject={{ name: "général", kind: "channel", channelId: "c1" }} />);
    expect(screen.getByText("Salon")).toBeInTheDocument();
    expect(screen.queryByText("Créé le", { exact: false })).not.toBeInTheDocument();
  });
});

describe("MessageList (état vide — la virtualisation est validée par screenshot)", () => {
  it("aucun message → état vide", () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByText("Aucun message")).toBeInTheDocument();
  });
});
