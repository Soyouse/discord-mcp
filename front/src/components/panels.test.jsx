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
});

describe("MessageList (état vide — la virtualisation est validée par screenshot)", () => {
  it("aucun message → état vide", () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByText("Aucun message")).toBeInTheDocument();
  });
});
