import { NextResponse } from "next/server";

import { getProviderHealth } from "@/lib/providers";

export function GET() {
  return NextResponse.json({
    app: "celstia",
    providers: getProviderHealth()
  });
}
