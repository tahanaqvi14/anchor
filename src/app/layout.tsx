import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/* Display: Fraunces, with the WONK and SOFT axes loaded so headlines get
   the flared, slightly off-kilter cut rather than a generic serif. */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

/* Mono is not decorative here — every offer, target and delta renders in
   it so figures align vertically wherever they appear. */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Anchor — practice the conversation before it costs you",
    template: "%s · Anchor",
  },
  description:
    "Negotiate against an AI that actually pushes back, then get a line-by-line breakdown of where you gave ground you didn't have to.",
  openGraph: {
    title: "Anchor — practice the conversation before it costs you",
    description:
      "Negotiate against an AI that actually pushes back, then get a line-by-line breakdown of where you gave ground you didn't have to.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0c0b" },
  ],
};

/* Runs before paint so a dark-mode user never sees a white flash. Reads the
   stored choice first, falls back to the OS preference. */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("anchor-theme");
    var dark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /* The font variables go on <html>, not <body>. Tailwind declares
       --font-sans/--font-display on :root, and a var() that is unresolvable
       where it is DECLARED makes the whole declaration invalid — so with the
       classes on <body> the theme fonts silently computed to empty and every
       element fell back to the default system stack. */
    <html
      lang="en"
      className={`${fraunces.variable} ${instrumentSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
