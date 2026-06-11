/*
 * Avatar (PURE) — image si `src`, sinon INITIALE du nom (fallback systématique : un hash absent ne doit
 * jamais donner d'img cassée). `onError` → retombe sur l'initiale (CDN down / hash périmé).
 */
import { useState } from "react";

export function Avatar({ src = null, name = "?", className = "h-9 w-9 rounded-full" }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`shrink-0 object-cover ${className}`}
      />
    );
  }
  return (
    <div className={`grid shrink-0 place-items-center bg-base-600 font-semibold text-text-normal ${className}`}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}
