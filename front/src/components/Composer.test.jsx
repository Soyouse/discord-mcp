import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Composer } from "./Composer.jsx";

const type = (v) => fireEvent.change(screen.getByLabelText("Message"), { target: { value: v } });

describe("Composer", () => {
  it("envoie sur clic et vide l'input", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    type("bonjour");
    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));
    expect(onSend).toHaveBeenCalledWith("bonjour");
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("envoie sur Entrée (sans Shift)", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    type("salut");
    fireEvent.keyDown(screen.getByLabelText("Message"), { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("salut");
  });

  it("Shift+Entrée n'envoie PAS (saut de ligne)", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    type("ligne");
    fireEvent.keyDown(screen.getByLabelText("Message"), { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("n'envoie jamais un message vide/espaces", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    type("   ");
    fireEvent.keyDown(screen.getByLabelText("Message"), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disabled → input inerte, aucun envoi", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled />);
    fireEvent.keyDown(screen.getByLabelText("Message"), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Message")).toBeDisabled();
  });
});
