import { useState } from "react";

/*
 * Composer (CONTRÔLÉ). Appelle onSend(texte) sur Entrée (sans Shift) ou clic Envoyer.
 * ⚠️ Garde-fou : n'émet JAMAIS un message vide/espaces. Vide l'input après envoi.
 * ⚠️ disabled (aucune conversation sélectionnée) → input inerte, pas d'envoi.
 */
export function Composer({ onSend, disabled = false, placeholder = "Envoyer un message" }) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend?.(trimmed);
    setText("");
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 px-4 pb-4">
      <textarea
        rows={1}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Message"
        className="max-h-40 flex-1 resize-none rounded-lg bg-base-600 px-4 py-2.5 text-sm text-text-normal placeholder:text-text-muted focus:outline-none disabled:opacity-50"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="rounded-lg bg-blurple px-4 py-2.5 text-sm font-medium text-white hover:bg-blurple-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        Envoyer
      </button>
    </div>
  );
}
