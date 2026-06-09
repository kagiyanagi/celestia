import { requireSessionUser } from "@/lib/auth";
import { getPrivateUser } from "@/lib/account-store";
import { buildMalExport } from "@/lib/mal-import";

export async function GET() {
  try {
    const sessionUser = await requireSessionUser();
    const user = await getPrivateUser(sessionUser.id);

    if (!user) {
      return new Response("Not found", { status: 404 });
    }

    const xml = buildMalExport(user.libraryEntries, user.username);

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": 'attachment; filename="celestia-anime-list.xml"',
      },
    });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
