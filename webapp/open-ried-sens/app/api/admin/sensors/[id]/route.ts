import { NextRequest, NextResponse } from "next/server";
import {
  getBackendAdminKey,
  getBackendUrl,
  isAuthenticated,
} from "@/lib/adminAuth";

export async function PUT(
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
    const res = await fetch(`${backendUrl}/api/v1/admin/sensors/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Fehler beim Aktualisieren" }));
      return NextResponse.json(
        { error: err.detail || "Fehler beim Aktualisieren des Sensors." },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(`Error updating sensor ${id}:`, err);
    return NextResponse.json(
      { error: "Verbindung zum Backend-Server fehlgeschlagen." },
      { status: 502 }
    );
  }
}

export async function DELETE(
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
  const purgeTelemetry = req.nextUrl.searchParams.get("purge_telemetry") === "true";
  const backendUrl = getBackendUrl();
  const adminKey = getBackendAdminKey();

  try {
    const res = await fetch(
      `${backendUrl}/api/v1/admin/sensors/${encodeURIComponent(id)}?purge_telemetry=${purgeTelemetry}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminKey}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Fehler beim Löschen" }));
      return NextResponse.json(
        { error: err.detail || "Fehler beim Löschen des Sensors." },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(`Error deleting sensor ${id}:`, err);
    return NextResponse.json(
      { error: "Verbindung zum Backend-Server fehlgeschlagen." },
      { status: 502 }
    );
  }
}
