/**
 * Opt-in IPv4-only networking, enabled by setting FORCE_IPV4=1.
 *
 * Why this exists: on a host with no IPv6 default route, Neon's DNS still
 * returns AAAA records. Node's happy-eyeballs then races an IPv6 connection
 * that fails with ENETUNREACH, and the failure is intermittent — it depends on
 * which address DNS hands back first. The symptom is a Neon query that succeeds
 * four times and fails the fifth.
 *
 * This is a local-development concern only. Vercel and Render both have working
 * IPv6, so FORCE_IPV4 should stay unset in production — hence opt-in rather
 * than always-on. Check `ip -6 route show default`; no output means you want it.
 *
 * The node builtins are imported DYNAMICALLY, inside the function, for a
 * specific reason. `instrumentation.ts` is compiled for the Edge runtime as
 * well as Node, and Edge has no `node:net` — static imports break that build.
 * An earlier version used `require` to dodge the same problem, which throws
 * "require is not defined" once bundled as ESM, so the guard silently never ran
 * and Neon kept failing intermittently exactly as if it had never been written.
 * Dynamic import satisfies both: Edge never evaluates it, and it works in ESM.
 */
export async function forceIpv4IfRequested(): Promise<void> {
  if (process.env.FORCE_IPV4 !== "1") return;

  const [dns, net] = await Promise.all([
    import("node:dns"),
    import("node:net"),
  ]);

  // Both halves are needed. Ordering alone still lets happy-eyeballs race the
  // AAAA address; disabling auto-select makes Node use the first result only.
  dns.default.setDefaultResultOrder("ipv4first");
  net.default.setDefaultAutoSelectFamily(false);
}
