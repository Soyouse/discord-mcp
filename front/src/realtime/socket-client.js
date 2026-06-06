/*
 * Wrapper socket.io-client (I/O). ⚠️ Le token JWT part dans le handshake `auth` (le serveur le vérifie
 * à la connexion — web/socket.js). Reconnexion/rooms = gérés par socket.io (pas de plomberie maison).
 * Le front ne parle qu'à l'API web (même origine en prod via nginx ; proxy /socket.io en dev).
 */
import { io } from "socket.io-client";

export function createSocket({ url = "/", getToken = () => null } = {}) {
  return io(url, {
    autoConnect: true,
    transports: ["websocket"],
    // auth dynamique : ré-évalué à chaque (re)connexion → token rafraîchi pris en compte.
    auth: (cb) => cb({ token: getToken() }),
  });
}
