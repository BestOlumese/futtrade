import { Room, type Client } from "colyseus";

/**
 * Phase 00 only. This room exists to prove one thing: the deployed Next.js
 * client can open a WebSocket to the deployed Colyseus service and exchange a
 * message. It holds no state and simulates nothing.
 *
 * The real match room — authoritative state, fixed tick loop — is Phase 01.
 * Do not grow this room into it; delete it when Phase 01 lands.
 */
export class BootstrapRoom extends Room {
  maxClients = 4;

  onCreate() {
    // Echo back with a server timestamp. The timestamp is the useful part: it
    // confirms the round trip reached the server process rather than being
    // answered by anything in between.
    this.onMessage("ping", (client, payload: unknown) => {
      client.send("pong", {
        echo: payload,
        serverTime: Date.now(),
        roomId: this.roomId,
      });
    });
  }

  onJoin(client: Client) {
    console.log(`[bootstrap] ${client.sessionId} joined`);
  }

  onLeave(client: Client) {
    console.log(`[bootstrap] ${client.sessionId} left`);
  }

  onDispose() {
    console.log("[bootstrap] room disposed");
  }
}
