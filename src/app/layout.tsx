import type { Metadata } from "next";
import { Paytone_One } from "next/font/google";

import { AuthProvider } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import "./globals.css";

const paytoneOne = Paytone_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-paytone",
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
      <body className={paytoneOne.variable}>
        <AuthProvider initialUser={initialUser} key={authKey}>
          <SiteHeader />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
