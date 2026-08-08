/**
 * Opt-in IPv4-only networking, enabled with FORCE_IPV4=1.
 *
 * Mirrors lib/force-ipv4.ts in the app package — the two are separate
 * deployments and share no code. The match server writes to Neon, so it hits
 * exactly the same failure: on a host with no IPv6 default route, Neon's DNS
 * still returns AAAA records, Node races a connection that fails with
 * ENETUNREACH, and the whole thing surfaces as a bare "fetch failed" that looks
 * like the database is down.
 *
 * Local development only. Render has working IPv6, so leave it unset there.
 */
export async function forceIpv4IfRequested(): Promise<void> {
  if (process.env.FORCE_IPV4 !== "1") return;

  const [dns, net] = await Promise.all([import("node:dns"), import("node:net")]);
  dns.default.setDefaultResultOrder("ipv4first");
  net.default.setDefaultAutoSelectFamily(false);
}
