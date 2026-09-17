import { fetchBudgets, fetchFinanceComparison, fetchSpending } from "@/lib/financeData";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "budgets";
  const municipality = searchParams.get("municipality") ?? undefined;
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : undefined;

  if (type === "spending") {
    const data = await fetchSpending(municipality, year);
    return NextResponse.json(data);
  }

  if (type === "compare") {
    const data = await fetchFinanceComparison(year ?? 2024);
    return NextResponse.json(data);
  }

  const data = await fetchBudgets(municipality, year);
  return NextResponse.json(data);
}
