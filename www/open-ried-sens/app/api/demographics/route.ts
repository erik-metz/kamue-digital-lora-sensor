import { env } from "@/env";
import {
  BASELINE_COMMUTER_FLOWS,
  BASELINE_FACILITIES,
  BASELINE_MUNICIPALITIES,
  BASELINE_SUMMARIES,
} from "@/lib/demographicsData";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "summary";
  const municipalityId = searchParams.get("municipality");

  try {
    if (type === "summary") {
      try {
        const res = await fetch(new URL("/api/v1/demographics/summary", env.BACKEND_API_URL), {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json(data);
        }
      } catch {
        // Use baseline on timeout/network issue
      }
      return NextResponse.json(BASELINE_SUMMARIES);
    }

    if (type === "facilities") {
      try {
        const url = new URL("/api/v1/demographics/facilities", env.BACKEND_API_URL);
        if (municipalityId && municipalityId !== "all") {
          url.searchParams.set("municipality_id", municipalityId);
        }
        const res = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json(data);
        }
      } catch {
        // Fallback
      }
      if (municipalityId && municipalityId !== "all") {
        return NextResponse.json(BASELINE_FACILITIES.filter(f => f.municipality_id === municipalityId));
      }
      return NextResponse.json(BASELINE_FACILITIES);
    }

    if (type === "commuters") {
      const muni = municipalityId && municipalityId !== "all" ? municipalityId : "buerstadt";
      try {
        const res = await fetch(new URL(`/api/v1/demographics/${muni}/commuters`, env.BACKEND_API_URL), {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json(data);
        }
      } catch {
        // Fallback
      }
      return NextResponse.json(BASELINE_COMMUTER_FLOWS.filter(c => c.home_municipality_id === muni));
    }

    return NextResponse.json(BASELINE_SUMMARIES);
  } catch {
    return NextResponse.json({ error: "Demographic data temporarily unavailable" }, { status: 500 });
  }
}
