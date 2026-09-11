import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/adminAuth";

export async function GET() {
  const backendUrl = getBackendUrl();

  try {
    const res = await fetch(`${backendUrl}/api/v1/sensors`, {
      method: "GET",
      next: { revalidate: 30 }, // Cache for 30s
    });

    if (!res.ok) {
      return NextResponse.json([], { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.warn("Could not fetch public sensors from backend:", err);
    return NextResponse.json([]);
  }
}
