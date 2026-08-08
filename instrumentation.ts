/**
 * Runs once when the Next.js server process starts.
 *
 * The module is imported dynamically inside the runtime check so the Edge
 * bundle never pulls in node builtins — Next compiles this file for both
 * runtimes, and Edge has no `node:net`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { forceIpv4IfRequested } = await import("./lib/force-ipv4");
  await forceIpv4IfRequested();
}
