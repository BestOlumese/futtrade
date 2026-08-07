import { forceIpv4IfRequested } from "./lib/force-ipv4";

/**
 * Runs once when the Next.js server process starts.
 * Applies the FORCE_IPV4 guard for local development on hosts with no IPv6
 * route — a no-op unless FORCE_IPV4=1. See lib/force-ipv4.ts.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    forceIpv4IfRequested();
  }
}
