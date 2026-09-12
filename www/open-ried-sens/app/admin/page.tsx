import AdminClient from "./AdminClient";
import { isAuthenticated } from "@/lib/adminAuth";
import { BackendError, listAdminSensors } from "@/lib/backend";

export const dynamic = "force-dynamic";

async function loadInitialSensors() {
  try {
    return { sensors: await listAdminSensors(), error: undefined };
  } catch (error) {
    console.error("Unable to load admin sensors:", error);
    return {
      sensors: [],
      error: error instanceof BackendError
        ? "Das Telemetrie-Backend ist derzeit nicht verfügbar."
        : "Die Sensorliste konnte nicht geladen werden.",
    };
  }
}

export default async function AdminPage() {
  const authenticated = await isAuthenticated();
  if (!authenticated) return <AdminClient initialAuthenticated={false} initialSensors={[]} />;
  const initial = await loadInitialSensors();
  return <AdminClient initialAuthenticated initialSensors={initial.sensors} initialError={initial.error} />;
}
