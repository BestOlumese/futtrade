import type { ReactNode } from "react";
import { Panel } from "@/components/ui/panel";

/**
 * Shared shell for every auth surface: one angular panel with corner brackets,
 * wordmark top-left, sentence-case display heading.
 * See docs/06-auth-pages.md.
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
    <Panel brackets bodyClassName="px-7 pt-7 pb-8">
      <div className="flex flex-col gap-7">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 bg-lime"
            style={{
              clipPath: "polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)",
            }}
          />
          <span className="label text-lime">Empire Live</span>
        </div>

        <div className="flex flex-col gap-2.5">
          <h1 className="display-lg text-floodlight">{title}</h1>
          {intro ? (
            <p className="font-sans text-sm leading-relaxed text-floodlight/50">
              {intro}
            </p>
          ) : null}
        </div>

        {children}

        {footer ? (
          <div className="flex flex-col gap-2.5 border-t border-steel/25 pt-5 font-sans text-sm">
            {footer}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/** Errors state what happened and what to do next — no apology register. */
export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="border-l-2 border-live bg-live/5 px-3 py-2.5 font-sans text-sm text-floodlight"
    >
      {children}
    </p>
  );
}

export function AuthLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="text-floodlight/45 transition-colors duration-instant hover:text-lime"
    >
      {children}
    </a>
  );
}
