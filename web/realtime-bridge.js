/**
 * Boucle PG LISTEN → Socket.IO : reçoit les NOTIFY du relais, diffuse aux clients du salon.
 * ⚠️ I/O → exclu mutation. La logique pure (parse + event→room) est dans realtime.js, testée.
 * ⚠️ `client` = un client PG DÉDIÉ et long-vécu (pas du pool : une connexion LISTEN reste ouverte).
 * EVENT_CHANNEL = constante interne (ascii, pas d'injection) → interpolable dans LISTEN.
 */
import { parseNotification, eventToEmit, EVENT_CHANNEL } from "./realtime.js";

export async function startPgListener(client, io) {
  client.on("notification", (msg) => {
    const event = parseNotification(msg.payload);
    const emit = eventToEmit(event);
    if (emit) io.to(emit.room).emit(emit.name, emit.data);
  });
  await client.query(`LISTEN ${EVENT_CHANNEL}`);
}
