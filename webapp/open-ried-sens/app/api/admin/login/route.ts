import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_CONFIG,
  createSessionToken,
  getAdminSecret,
} from "@/lib/adminAuth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Passwort erforderlich." },
        { status: 400 }
      );
    }

    const expectedSecret = getAdminSecret();

    // Constant-time comparison
    const passwordBuffer = Buffer.from(password);
    const secretBuffer = Buffer.from(expectedSecret);

    const isMatch =
      passwordBuffer.length === secretBuffer.length &&
      crypto.timingSafeEqual(passwordBuffer, secretBuffer);

    if (!isMatch) {
      return NextResponse.json(
        { error: "Ungültiges Admin-Passwort." },
        { status: 401 }
      );
    }

    const sessionToken = createSessionToken();
    const response = NextResponse.json({
      success: true,
      message: "Erfolgreich angemeldet.",
    });

    response.cookies.set({
      ...ADMIN_COOKIE_CONFIG,
      value: sessionToken,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Serverfehler beim Login." },
      { status: 500 }
    );
  }
}
