import { NextRequest, NextResponse } from "next/server";
import {
  getBackendAdminKey,
  getBackendUrl,
  isAuthenticated,
} from "@/lib/adminAuth";

// Fallback initial stations for local preview if VPS backend is not running locally
const LOCAL_FALLBACK_SENSORS = [
  {
    sensor_id: "ried-01",
    friendly_name: "Station 1: Bürstadt Mitte",
    latitude: 49.6425,
    longitude: 8.456,
    is_hidden: false,
    description: "KAMÜ Kulturzentrum Industriestr. 11, 68642 Bürstadt",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    sensor_id: "ried-02",
    friendly_name: "Station 2: Lampertheim Nord",
    latitude: 49.605,
    longitude: 8.468,
    is_hidden: false,
    description: "Privatgrundstück Nordstadt, Am Sandacker 4",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    sensor_id: "ried-03",
    friendly_name: "Station 3: Ried-West",
    latitude: 49.621,
    longitude: 8.415,
    is_hidden: false,
    description: "Rheinauen Biotop, Rheinauenweg Bürstadt",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    sensor_id: "ried-04",
    friendly_name: "Station 4: Bürstadt Süd",
    latitude: 49.631,
    longitude: 8.472,
    is_hidden: false,
    description: "Agrar- & Feldmesspunkt, Riedstraße 22",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    sensor_id: "ried-05",
    friendly_name: "Station 5: Lampertheim Ost",
    latitude: 49.589,
    longitude: 8.489,
    is_hidden: false,
    description: "Garten & Wohnumfeld, Wormser Straße 58",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export async function GET() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json(
      { error: "Nicht autorisiert. Bitte anmelden." },
      { status: 401 }
    );
  }

  const backendUrl = getBackendUrl();
  const adminKey = getBackendAdminKey();

  try {
    const res = await fetch(`${backendUrl}/api/v1/admin/sensors`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminKey}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: `Backend Fehler (${res.status}): ${errorText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.warn("Backend API unreachable, using local fallback sensors:", err);
    return NextResponse.json(LOCAL_FALLBACK_SENSORS, {
      headers: { "X-Backend-Status": "offline-fallback" },
    });
  }
}

export async function POST(req: NextRequest) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json(
      { error: "Nicht autorisiert. Bitte anmelden." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const backendUrl = getBackendUrl();
    const adminKey = getBackendAdminKey();

    const res = await fetch(`${backendUrl}/api/v1/admin/sensors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Unbekannter Fehler" }));
      return NextResponse.json(
        { error: err.detail || "Fehler beim Erstellen des Sensors." },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Error creating sensor:", err);
    return NextResponse.json(
      { error: "Verbindung zum Backend-Server fehlgeschlagen." },
      { status: 502 }
    );
  }
}
