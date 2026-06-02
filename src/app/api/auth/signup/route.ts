import { NextResponse } from "next/server";
import { createSession, createUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      displayName?: string;
      username?: string;
    };

    if (!body.email || !body.password || !body.displayName || !body.username) {
      return NextResponse.json(
        { error: "Missing required account fields." },
        { status: 400 },
      );
    }

    const user = await createUser({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      username: body.username,
    });

    await createSession(user.id);

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sign-up failed." },
      { status: 400 },
    );
  }
}
