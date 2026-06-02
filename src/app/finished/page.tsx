import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import { getBrowseCollection } from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Finished"
};

export default async function FinishedPage() {
  const items = await getBrowseCollection("finished");

  return (
    <BrowsePageShell
      eyebrow="completed series"
      title="Just Finished"
      description="Popular finished shows you can binge without waiting."
      items={items}
    />
  );
}
