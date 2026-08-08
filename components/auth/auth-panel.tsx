import type { ReactNode } from "react";
import { Panel } from "@/components/ui/panel";

/**
 * Shared shell for every auth surface: one centered chamfered panel, wordmark
 * top-left, sentence-case display heading. See docs/06-auth-pages.md.
 */
export function AuthPanel({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Panel>
      <div className="flex flex-col gap-7 px-7 pt-7 pb-8">
        <p className="eyebrow text-floodlight/70">Empire Live</p>

        <div className="flex flex-col gap-2">
          <h1 className="display-md text-floodlight">{title}</h1>
          {intro ? (
            <p className="font-sans text-sm leading-relaxed text-floodlight/55">
              {intro}
            </p>
          ) : null}
        </div>

        {children}

        {footer ? (
          <div className="flex flex-col gap-2 border-t border-steel/30 pt-5 font-sans text-sm">
            {footer}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/**
 * Errors state what happened and what to do next — no apology register.
 */
export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="border-l-2 border-tally pl-3 font-sans text-sm text-floodlight"
    >
      {children}
    </p>
  );
}
