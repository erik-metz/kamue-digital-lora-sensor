import { env } from "@/env";
import {
  BASELINE_BORIS_ZONES,
  BASELINE_CONSTRUCTION_PERMITS,
  BASELINE_DEVELOPMENT_PLANS,
  BASELINE_HOUSING_STOCK,
  BASELINE_MARKET_BENCHMARKS,
  BASELINE_REALESTATE_SUMMARIES,
} from "@/lib/realestateData";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "summary";
  const municipality = searchParams.get("municipality");

  try {
    if (type === "summary") {
      try {
        const res = await fetch(new URL("/api/v1/realestate/summary", env.BACKEND_API_URL), {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          return NextResponse.json(await res.json());
        }
      } catch {
        // Fallback to baseline
      }
      return NextResponse.json(BASELINE_REALESTATE_SUMMARIES);
    }

    if (type === "housing-stock") {
      try {
        const url = new URL("/api/v1/realestate/housing-stock", env.BACKEND_API_URL);
        if (municipality && municipality !== "all") {
          url.searchParams.set("municipality", municipality);
        }
        const res = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          return NextResponse.json(await res.json());
        }
      } catch {
        // Fallback
      }
      if (municipality && municipality !== "all") {
        return NextResponse.json(
          BASELINE_HOUSING_STOCK.filter(h => h.municipality.toLowerCase() === municipality.toLowerCase())
        );
      }
      return NextResponse.json(BASELINE_HOUSING_STOCK);
    }

    if (type === "boris") {
      try {
        const url = new URL("/api/v1/realestate/boris", env.BACKEND_API_URL);
        if (municipality && municipality !== "all") {
          url.searchParams.set("municipality", municipality);
        }
        const res = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          return NextResponse.json(await res.json());
        }
      } catch {
        // Fallback
      }
      if (municipality && municipality !== "all") {
        return NextResponse.json(
          BASELINE_BORIS_ZONES.filter(b => b.municipality.toLowerCase() === municipality.toLowerCase())
        );
      }
      return NextResponse.json(BASELINE_BORIS_ZONES);
    }

    if (type === "construction") {
      try {
        const url = new URL("/api/v1/realestate/construction-activity", env.BACKEND_API_URL);
        if (municipality && municipality !== "all") {
          url.searchParams.set("municipality", municipality);
        }
        const res = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          return NextResponse.json(await res.json());
        }
      } catch {
        // Fallback
      }
      if (municipality && municipality !== "all") {
        return NextResponse.json(
          BASELINE_CONSTRUCTION_PERMITS.filter(c => c.municipality.toLowerCase() === municipality.toLowerCase())
        );
      }
      return NextResponse.json(BASELINE_CONSTRUCTION_PERMITS);
    }

    if (type === "benchmarks") {
      try {
        const url = new URL("/api/v1/realestate/market-benchmarks", env.BACKEND_API_URL);
        if (municipality && municipality !== "all") {
          url.searchParams.set("municipality", municipality);
        }
        const res = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          return NextResponse.json(await res.json());
        }
      } catch {
        // Fallback
      }
      if (municipality && municipality !== "all") {
        return NextResponse.json(
          BASELINE_MARKET_BENCHMARKS.filter(m => m.municipality.toLowerCase() === municipality.toLowerCase())
        );
      }
      return NextResponse.json(BASELINE_MARKET_BENCHMARKS);
    }

    if (type === "development-plans") {
      try {
        const url = new URL("/api/v1/realestate/development-plans", env.BACKEND_API_URL);
        if (municipality && municipality !== "all") {
          url.searchParams.set("municipality", municipality);
        }
        const res = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          return NextResponse.json(await res.json());
        }
      } catch {
        // Fallback
      }
      if (municipality && municipality !== "all") {
        return NextResponse.json(
          BASELINE_DEVELOPMENT_PLANS.filter(d => d.municipality.toLowerCase() === municipality.toLowerCase())
        );
      }
      return NextResponse.json(BASELINE_DEVELOPMENT_PLANS);
    }

    return NextResponse.json({ error: "Invalid type requested" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process real estate data request", details: String(error) },
      { status: 500 }
    );
  }
}
