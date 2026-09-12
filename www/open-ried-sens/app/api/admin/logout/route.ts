import { NextResponse } from "next/server";
import { ADMIN_COOKIE_CONFIG } from "@/lib/adminAuth";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Erfolgreich abgemeldet.",
  });

  response.cookies.set({
    ...ADMIN_COOKIE_CONFIG,
    value: "",
    maxAge: 0,
  });

  return response;
}
