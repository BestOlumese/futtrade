import type { ReactNode } from "react";

/**
 * Auth shell. One centered panel on a plain `void` field — no split-screen,
 * no background match footage, no tally dot. Nothing here is live.
 * See docs/06-auth-pages.md.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-4 py-12">
      <div className="w-full max-w-[420px]">{children}</div>
    </main>
  );
}
