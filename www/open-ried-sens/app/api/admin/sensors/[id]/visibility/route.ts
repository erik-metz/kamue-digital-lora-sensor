import { NextRequest, NextResponse } from "next/server";
import {
  getBackendAdminKey,
  getBackendUrl,
  isAuthenticated,
} from "@/lib/adminAuth";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json(
      { error: "Nicht autorisiert. Bitte anmelden." },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const backendUrl = getBackendUrl();
  const adminKey = getBackendAdminKey();

  try {
    const body = await req.json();
    const res = await fetch(
      `${backendUrl}/api/v1/admin/sensors/${encodeURIComponent(id)}/visibility`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Fehler beim Ändern der Sichtbarkeit" }));
      return NextResponse.json(
        { error: err.detail || "Fehler beim Umschalten der Sichtbarkeit." },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(`Error toggling visibility for sensor ${id}:`, err);
    return NextResponse.json(
      { error: "Verbindung zum Backend-Server fehlgeschlagen." },
      { status: 502 }
    );
  }
}
