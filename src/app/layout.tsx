import type { Metadata } from "next";
import { Manrope, Paytone_One } from "next/font/google";

import { AuthProvider } from "@/components/auth-provider";
import { BannerFallbackProvider } from "@/components/banner-fallback-provider";
import { DubBadgeProvider } from "@/components/dub-badge-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ToastProvider } from "@/components/toast-provider";
import { getSessionPublicUser } from "@/lib/auth";
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
  const user = await getSessionPublicUser();
  const theme = user?.preferences?.whiteMode ? "light" : "dark";

  return (
    <html lang="en" data-theme={theme} style={{ colorScheme: theme }}>
      <body className={`${paytoneOne.variable} ${manrope.variable}`}>
        <ToastProvider>
          <AuthProvider initialUser={user}>
            <DubBadgeProvider>
              <BannerFallbackProvider>
                <SiteHeader />
                <main>{children}</main>
                <SiteFooter />
              </BannerFallbackProvider>
            </DubBadgeProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
