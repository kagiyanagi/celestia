import type { Metadata } from "next";
import { Manrope, Paytone_One } from "next/font/google";

import { AuthProvider } from "@/components/auth-provider";
import { BannerFallbackProvider } from "@/components/banner-fallback-provider";
import { DubBadgeProvider } from "@/components/dub-badge-provider";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import "./globals.css";
import "./polish.css";

const paytoneOne = Paytone_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-paytone",
});

// Self-hosted via next/font (was a render-blocking Google Fonts @import in
// globals.css). Manrope is a variable font, so the full 400–800 range loads
// from one optimized, preloaded file.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Celestia - Watch Anime",
    template: "%s | Celestia",
  },
  description:
    "Watch anime, discover new seasons, and keep track of every episode with Celestia.",
  metadataBase: new URL("http://localhost:3000"),
  icons: {
    icon: "/icon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getSessionUser();
  const authKey = initialUser
    ? [
        initialUser.id,
        initialUser.username,
        Boolean(initialUser.aniListProfile),
        initialUser.libraryEntries.length,
        initialUser.historyEntries.length,
      ].join(":")
    : "anonymous";

  return (
    <html lang="en">
      <body className={`${paytoneOne.variable} ${manrope.variable}`}>
        <AuthProvider initialUser={initialUser} key={authKey}>
          <DubBadgeProvider>
            <BannerFallbackProvider>
              <SiteHeader />
              <main>{children}</main>
            </BannerFallbackProvider>
          </DubBadgeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
