import {
  fetchBusinessRegistrations,
  fetchCompanies,
  fetchEconomyOverview,
  fetchIndustryStructure,
  fetchStartupInitiatives,
  fetchTaxRates,
} from "@/lib/economyData";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "overview";
  const municipalityId = searchParams.get("municipality") ?? undefined;
  const sector = searchParams.get("sector") ?? undefined;
  const regionCode = searchParams.get("region") ?? undefined;
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : 2024;

  if (type === "companies") {
    const data = await fetchCompanies({
      municipality_id: municipalityId,
      industry_sector: sector,
    });
    return NextResponse.json(data);
  }

  if (type === "taxes") {
    const data = await fetchTaxRates(year);
    return NextResponse.json(data);
  }

  if (type === "registrations") {
    const data = await fetchBusinessRegistrations(regionCode);
    return NextResponse.json(data);
  }

  if (type === "industry") {
    const data = await fetchIndustryStructure(regionCode ?? "kreis-bergstrasse", year);
    return NextResponse.json(data);
  }

  if (type === "startups") {
    const data = await fetchStartupInitiatives();
    return NextResponse.json(data);
  }

  const overview = await fetchEconomyOverview(year);
  return NextResponse.json(overview);
}
