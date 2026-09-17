import { fetchElections } from "@/lib/electionsData";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const municipality = searchParams.get("municipality") ?? undefined;
  const data = await fetchElections(municipality);
  return NextResponse.json(data);
}
