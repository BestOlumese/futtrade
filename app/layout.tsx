import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// docs/04-design-system.md § Typography.
// Display is condensed and heavy — it should feel like a scoreboard, not decoration.
//
// `opsz` is requested explicitly. Big Shoulders is an optical-size variable
// font whose axis defaults to 14, so without this every headline renders with
// letterforms drawn for body copy — wide and loose at 80px, which is exactly
// the opposite of the condensed, structural feel the design system asks for.
// The .display-* utilities in globals.css set the axis to match their size.
//
// `fallback` is set because Google publishes no metric overrides for this
// family; without it the fallback is a non-condensed system font and the page
// visibly reflows when the webfont lands.
const bigShoulders = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-big-shoulders",
  display: "swap",
  fallback: ["Arial Narrow", "Helvetica Neue Condensed", "sans-serif"],
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

// Every live number in the product renders in this face, with tabular-nums.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Empire Live",
  description:
    "Manage a football club, play live 1v1 matches, and trade the players who decide them.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${bigShoulders.variable} ${plexSans.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
