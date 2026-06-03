import { NextResponse } from "next/server";
import { authenticateUser, createSession } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = await rateLimitResponse("auth:login", {
    limit: 8,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const user = await authenticateUser(body.email, body.password);
    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed." },
      { status: 401 },
    );
  }
}
