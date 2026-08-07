/**
 * Opt-in IPv4-only networking, enabled by setting FORCE_IPV4=1.
 *
 * Why this exists: on a host with no IPv6 default route, Neon's DNS still
 * returns AAAA records. Node's happy-eyeballs then races an IPv6 connection
 * that fails with ENETUNREACH, and the failure is intermittent — it depends on
 * which address DNS hands back first. The symptom is a Neon query or migration
 * that succeeds four times and hangs the fifth.
 *
 * This is a local-development concern only. Vercel and Render both have working
 * IPv6, so FORCE_IPV4 should stay unset in production — hence opt-in rather
 * than always-on.
 *
 * Check `ip -6 route show default`; if it prints nothing, you want this.
 */
export function forceIpv4IfRequested(): void {
  if (process.env.FORCE_IPV4 !== "1") return;

  // Both halves are needed. Ordering alone still lets happy-eyeballs race the
  // AAAA address; disabling auto-select makes Node use the first result only.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dns = require("node:dns") as typeof import("node:dns");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const net = require("node:net") as typeof import("node:net");

  dns.setDefaultResultOrder("ipv4first");
  net.setDefaultAutoSelectFamily(false);
}
