import { NextResponse } from "next/server";
import { requireSessionUser, revokeDevice, revokeOtherDevices } from "@/lib/auth";

export async function DELETE(request: Request) {
  try {
    await requireSessionUser();
    const body = (await request.json().catch(() => ({}))) as {
      deviceId?: string;
    };

    const user =
      typeof body.deviceId === "string" && body.deviceId
        ? await revokeDevice(body.deviceId)
        : await revokeOtherDevices();

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update sessions.",
      },
      { status: 400 },
    );
  }
}
