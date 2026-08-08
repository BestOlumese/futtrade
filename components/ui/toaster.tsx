"use client";

import { Toaster as Sonner, toast } from "sonner";

/**
 * Toasts, styled to the system: `surface` fill, the angular bottom-right cut
 * that every action in this system carries, and an accent edge — `lime` for
 * something that worked, `live` for something that didn't.
 *
 * Colour is never the only signal: each variant is introduced by a short word
 * ("Done", "Problem"), so a toast still reads correctly without it.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      // The design system has no rounded corners, and Sonner's defaults are
      // rounded and light — every surface is overridden rather than themed.
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "cut-btn flex w-full items-start gap-3 border border-steel/40 bg-surface px-4 py-3 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.8)]",
          title: "font-sans text-sm font-semibold text-floodlight",
          description: "font-sans text-xs leading-relaxed text-mute",
          actionButton:
            "cut-btn bg-lime px-2.5 py-1 font-sans text-xs font-semibold text-midnight",
          cancelButton:
            "font-sans text-xs text-mute hover:text-floodlight",
          success: "border-l-2 border-l-lime",
          error: "border-l-2 border-l-live",
          info: "border-l-2 border-l-steel",
        },
      }}
      duration={5000}
      gap={10}
    />
  );
}

/**
 * Wrappers so callers can't drift from the voice rules: say what happened and
 * what to do, no apology register.
 */
export const notify = {
  ok: (title: string, description?: string) =>
    toast.success(title, { description }),
  problem: (title: string, description?: string) =>
    toast.error(title, { description }),
  info: (title: string, description?: string) => toast(title, { description }),
};
