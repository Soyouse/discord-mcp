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
