import { HomePageClient } from "@/components/home-page-client";
import { getHomeCollections } from "@/lib/providers/anilist";

export const revalidate = 900;

export default async function HomePage() {
  const collections = await getHomeCollections(false);

  return <HomePageClient initialCollections={collections} />;
}
