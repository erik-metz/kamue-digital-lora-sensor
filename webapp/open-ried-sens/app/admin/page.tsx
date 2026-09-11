"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Lock,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface SensorItem {
  sensor_id: string;
  friendly_name: string;
  latitude: number | null;
  longitude: number | null;
  is_hidden: boolean;
  description?: string | null;
  created_at?: string;
  updated_at?: string | null;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Dashboard state
  const [sensors, setSensors] = useState<SensorItem[]>([]);
  const [loadingSensors, setLoadingSensors] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVisibility, setFilterVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<SensorItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({
    sensor_id: "",
    friendly_name: "",
    latitude: "",
    longitude: "",
    description: "",
    is_hidden: false,
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    friendly_name: "",
    latitude: "",
    longitude: "",
    description: "",
    is_hidden: false,
  });

  // Check authentication on mount
  useEffect(() => {
    async function initSession() {
      try {
        const res = await fetch("/api/admin/session");
        const data = await res.json();
        setIsAuthenticated(data.authenticated);
        if (data.authenticated) {
          fetchSensors();
        }
      } catch {
        setIsAuthenticated(false);
      }
    }
    initSession();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setAuthError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Anmeldung fehlgeschlagen.");
      } else {
        setIsAuthenticated(true);
        setPassword("");
        fetchSensors();
      }
    } catch {
      setAuthError("Netzwerkfehler beim Anmelden.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      setIsAuthenticated(false);
      setSensors([]);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }

  async function fetchSensors() {
    setLoadingSensors(true);
    try {
      const res = await fetch("/api/admin/sensors");
      if (res.ok) {
        const data = await res.json();
        setSensors(Array.isArray(data) ? data : []);
      } else {
        setFeedbackMessage({
          type: "error",
          text: "Fehler beim Laden der Sensorliste.",
        });
      }
    } catch {
      setFeedbackMessage({
        type: "error",
        text: "Verbindung zum Server fehlgeschlagen.",
      });
    } finally {
      setLoadingSensors(false);
    }
  }

  // Quick toggle visibility
  async function toggleVisibility(sensor: SensorItem) {
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/admin/sensors/${encodeURIComponent(sensor.sensor_id)}/visibility`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_hidden: !sensor.is_hidden }),
        }
      );

      if (res.ok) {
        const updated = await res.json();
        setSensors((prev) =>
          prev.map((s) =>
            s.sensor_id === sensor.sensor_id ? { ...s, ...updated } : s
          )
        );
        setFeedbackMessage({
          type: "success",
          text: `Station '${sensor.sensor_id}' ist nun ${
            updated.is_hidden ? "ausgeblendet (privat)" : "öffentlich sichtbar"
          }.`,
        });
      } else {
        const err = await res.json();
        setFeedbackMessage({
          type: "error",
          text: err.error || "Fehler beim Ändern der Sichtbarkeit.",
        });
      }
    } catch {
      setFeedbackMessage({
        type: "error",
        text: "Netzwerkfehler beim Aktualisieren.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  // Submit Create Sensor
  async function handleCreateSensor(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setFeedbackMessage(null);

    const payload = {
      sensor_id: createForm.sensor_id.trim(),
      friendly_name: createForm.friendly_name.trim(),
      latitude: createForm.latitude ? parseFloat(createForm.latitude) : null,
      longitude: createForm.longitude ? parseFloat(createForm.longitude) : null,
      description: createForm.description.trim() || null,
      is_hidden: createForm.is_hidden,
    };

    try {
      const res = await fetch("/api/admin/sensors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created = await res.json();
        setSensors((prev) => [created, ...prev]);
        setCreateModalOpen(false);
        setCreateForm({
          sensor_id: "",
          friendly_name: "",
          latitude: "",
          longitude: "",
          description: "",
          is_hidden: false,
        });
        setFeedbackMessage({
          type: "success",
          text: `Sensor '${created.sensor_id}' erfolgreich registriert!`,
        });
      } else {
        const err = await res.json();
        setFeedbackMessage({
          type: "error",
          text: err.error || "Sensor konnte nicht erstellt werden.",
        });
      }
    } catch {
      setFeedbackMessage({
        type: "error",
        text: "Verbindungsfehler beim Anlegen des Sensors.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  // Open Edit Modal
  function openEditModal(sensor: SensorItem) {
    setSelectedSensor(sensor);
    setEditForm({
      friendly_name: sensor.friendly_name,
      latitude: sensor.latitude !== null ? sensor.latitude.toString() : "",
      longitude: sensor.longitude !== null ? sensor.longitude.toString() : "",
      description: sensor.description || "",
      is_hidden: sensor.is_hidden,
    });
    setEditModalOpen(true);
  }

  // Submit Edit Sensor
  async function handleEditSensor(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSensor) return;
    setActionLoading(true);
    setFeedbackMessage(null);

    const payload = {
      friendly_name: editForm.friendly_name.trim(),
      latitude: editForm.latitude ? parseFloat(editForm.latitude) : null,
      longitude: editForm.longitude ? parseFloat(editForm.longitude) : null,
      description: editForm.description.trim() || null,
      is_hidden: editForm.is_hidden,
    };

    try {
      const res = await fetch(
        `/api/admin/sensors/${encodeURIComponent(selectedSensor.sensor_id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        const updated = await res.json();
        setSensors((prev) =>
          prev.map((s) =>
            s.sensor_id === selectedSensor.sensor_id ? { ...s, ...updated } : s
          )
        );
        setEditModalOpen(false);
        setSelectedSensor(null);
        setFeedbackMessage({
          type: "success",
          text: `Station '${updated.sensor_id}' wurde erfolgreich aktualisiert.`,
        });
      } else {
        const err = await res.json();
        setFeedbackMessage({
          type: "error",
          text: err.error || "Aktualisierung fehlgeschlagen.",
        });
      }
    } catch {
      setFeedbackMessage({
        type: "error",
        text: "Verbindungsfehler beim Speichern der Änderungen.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  // Open Delete Modal
  function openDeleteModal(sensor: SensorItem) {
    setSelectedSensor(sensor);
    setDeleteModalOpen(true);
  }

  // Confirm Delete
  async function handleDeleteSensor(purgeTelemetry: boolean) {
    if (!selectedSensor) return;
    setActionLoading(true);

    try {
      const res = await fetch(
        `/api/admin/sensors/${encodeURIComponent(
          selectedSensor.sensor_id
        )}?purge_telemetry=${purgeTelemetry}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        if (purgeTelemetry) {
          setSensors((prev) =>
            prev.filter((s) => s.sensor_id !== selectedSensor.sensor_id)
          );
          setFeedbackMessage({
            type: "success",
            text: `Station '${selectedSensor.sensor_id}' und alle Telemetriepunkte wurden dauerhaft gelöscht.`,
          });
        } else {
          // Soft-delete: marked hidden
          setSensors((prev) =>
            prev.map((s) =>
              s.sensor_id === selectedSensor.sensor_id
                ? { ...s, is_hidden: true }
                : s
            )
          );
          setFeedbackMessage({
            type: "success",
            text: `Station '${selectedSensor.sensor_id}' wurde ausgeblendet. Die historischen Daten bleiben archiviert.`,
          });
        }
        setDeleteModalOpen(false);
        setSelectedSensor(null);
      } else {
        const err = await res.json();
        setFeedbackMessage({
          type: "error",
          text: err.error || "Löschen fehlgeschlagen.",
        });
      }
    } catch {
      setFeedbackMessage({
        type: "error",
        text: "Verbindungsfehler beim Löschen.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  // Filtered sensors
  const filteredSensors = sensors.filter((s) => {
    const matchesSearch =
      s.sensor_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.friendly_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterVisibility === "visible") return !s.is_hidden;
    if (filterVisibility === "hidden") return s.is_hidden;
    return true;
  });

  const totalCount = sensors.length;
  const visibleCount = sensors.filter((s) => !s.is_hidden).length;
  const hiddenCount = sensors.filter((s) => s.is_hidden).length;

  // 1. Loading screen during session check
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
          <span>Sitzung wird überprüft...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-8 translate-x-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">
                Admin Control Panel
              </h1>
              <p className="text-xs text-emerald-400 font-medium tracking-wide uppercase">
                Open Ried Sens Management
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Nur autorisierte Administratorinnen und Administratoren des Projekts
            dürfen Stationen anlegen, konfigurieren, verbergen oder löschen.
          </p>

          {authError && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Admin-Passwort
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passwort eingeben..."
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-4 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Prüfe Zugang...
                </>
              ) : (
                "Anmelden"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Zurück zur Hauptseite
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Admin Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-100">
                  Open Ried Sens
                </span>
                <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Admin Panel
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Geschützter Verwaltungsbereich für Sensoren & Stationen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-slate-700 transition-all"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Website ansehen</span>
            </Link>
            <Link
              href="/daten"
              className="flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-slate-700 transition-all"
            >
              <Server className="w-4 h-4" />
              <span className="hidden sm:inline">API-Doku</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Toast / Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
              feedbackMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedbackMessage.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              )}
              <span className="text-sm font-medium">{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-slate-400 hover:text-slate-100 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Overview Stats Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Stationen Gesamt</span>
              <Radio className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-100 mt-2">
              {totalCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">Registrierte Messpunkte</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Öffentlich Sichtbar</span>
              <Eye className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-extrabold text-emerald-400 mt-2">
              {visibleCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Im Dashboard & Open-Data API aktiv
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Ausgeblendet (Privat)</span>
              <EyeOff className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-3xl font-extrabold text-amber-400 mt-2">
              {hiddenCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              In Tests oder verborgen
            </p>
          </div>
        </div>

        {/* Actions & Filters Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Sensor-ID, Name oder Ort durchsuchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Visibility Filter Tabs */}
            <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                onClick={() => setFilterVisibility("all")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  filterVisibility === "all"
                    ? "bg-slate-800 text-slate-100 font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Alle ({totalCount})
              </button>
              <button
                onClick={() => setFilterVisibility("visible")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  filterVisibility === "visible"
                    ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sichtbar ({visibleCount})
              </button>
              <button
                onClick={() => setFilterVisibility("hidden")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  filterVisibility === "hidden"
                    ? "bg-amber-500/20 text-amber-300 font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Ausgeblendet ({hiddenCount})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchSensors}
              disabled={loadingSensors}
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
              title="Aktualisieren"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingSensors ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 text-sm transition-all"
            >
              <Plus className="w-4 h-4 font-bold" />
              <span>Neuen Sensor anlegen</span>
            </button>
          </div>
        </div>

        {/* Sensors Table / List */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3.5 px-6 font-semibold">Sensor-ID</th>
                  <th className="py-3.5 px-6 font-semibold">Bezeichnung & Ort</th>
                  <th className="py-3.5 px-6 font-semibold">GPS-Koordinaten</th>
                  <th className="py-3.5 px-6 font-semibold">Status / Sichtbarkeit</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSensors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Keine Sensoren gefunden.
                    </td>
                  </tr>
                ) : (
                  filteredSensors.map((sensor) => (
                    <tr
                      key={sensor.sensor_id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Sensor ID */}
                      <td className="py-4 px-6 font-mono font-bold text-emerald-400">
                        {sensor.sensor_id}
                      </td>

                      {/* Name & Description */}
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-100">
                          {sensor.friendly_name}
                        </div>
                        {sensor.description && (
                          <div className="text-xs text-slate-400 mt-0.5 max-w-xs truncate">
                            {sensor.description}
                          </div>
                        )}
                      </td>

                      {/* GPS Coordinates */}
                      <td className="py-4 px-6 font-mono text-xs text-slate-400">
                        {sensor.latitude !== null && sensor.longitude !== null ? (
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${sensor.latitude}&mlon=${sensor.longitude}#map=16/${sensor.latitude}/${sensor.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
                          >
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>
                              {sensor.latitude.toFixed(4)},{" "}
                              {sensor.longitude.toFixed(4)}
                            </span>
                          </a>
                        ) : (
                          <span className="text-slate-600">Keine Koordinaten</span>
                        )}
                      </td>

                      {/* Status / Visibility Badge */}
                      <td className="py-4 px-6">
                        {sensor.is_hidden ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <EyeOff className="w-3 h-3" /> Ausgeblendet (Privat)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Eye className="w-3 h-3" /> Öffentlich Sichtbar
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-6 text-right space-x-2">
                        {/* Toggle Visibility */}
                        <button
                          onClick={() => toggleVisibility(sensor)}
                          disabled={actionLoading}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            sensor.is_hidden
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
                          }`}
                          title={
                            sensor.is_hidden
                              ? "Öffentlich sichtbar machen"
                              : "Ausblenden (verbergen)"
                          }
                        >
                          {sensor.is_hidden ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>

                        {/* Edit Sensor */}
                        <button
                          onClick={() => openEditModal(sensor)}
                          className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-emerald-400 hover:border-slate-600 transition-colors"
                          title="Metadaten bearbeiten"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Delete Sensor */}
                        <button
                          onClick={() => openDeleteModal(sensor)}
                          className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors"
                          title="Löschen oder archivieren"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* CREATE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Plus className="w-5 h-5 font-bold" />
                </div>
                <h2 className="text-lg font-bold text-slate-100">
                  Neuen Sensor registrieren
                </h2>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSensor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Sensor-ID * (e.g. ried-06)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ried-06"
                  value={createForm.sensor_id}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, sensor_id: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Bezeichnung / Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Station 6: Bürstadt Waldgarten"
                  value={createForm.friendly_name}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      friendly_name: e.target.value,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Breitengrad (Lat)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="49.6425"
                    value={createForm.latitude}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, latitude: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Längengrad (Lng)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="8.4560"
                    value={createForm.longitude}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        longitude: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Standort-Beschreibung / Adresse
                </label>
                <textarea
                  rows={2}
                  placeholder="Industriestr. 11, 68642 Bürstadt..."
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <input
                  type="checkbox"
                  id="create_is_hidden"
                  checked={createForm.is_hidden}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      is_hidden: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700"
                />
                <label
                  htmlFor="create_is_hidden"
                  className="text-xs text-slate-300 cursor-pointer"
                >
                  Als <strong>ausgeblendet (privat)</strong> anlegen (nicht im
                  öffentlichen Dashboard anzeigen)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    "Sensor anlegen"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModalOpen && selectedSensor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-100">
                    Station bearbeiten
                  </h2>
                  <p className="text-xs font-mono text-emerald-400">
                    ID: {selectedSensor.sensor_id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSensor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Bezeichnung / Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.friendly_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, friendly_name: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Breitengrad (Lat)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.latitude}
                    onChange={(e) =>
                      setEditForm({ ...editForm, latitude: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Längengrad (Lng)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.longitude}
                    onChange={(e) =>
                      setEditForm({ ...editForm, longitude: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Standort-Beschreibung / Adresse
                </label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <input
                  type="checkbox"
                  id="edit_is_hidden"
                  checked={editForm.is_hidden}
                  onChange={(e) =>
                    setEditForm({ ...editForm, is_hidden: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700"
                />
                <label
                  htmlFor="edit_is_hidden"
                  className="text-xs text-slate-300 cursor-pointer"
                >
                  Als <strong>ausgeblendet (privat)</strong> markieren (nicht im
                  öffentlichen Dashboard anzeigen)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    "Änderungen speichern"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModalOpen && selectedSensor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">
                  Station entfernen?
                </h2>
                <p className="text-xs font-mono text-slate-400">
                  {selectedSensor.sensor_id} ({selectedSensor.friendly_name})
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Wie möchtest du mit dieser Station verfahren?
            </p>

            <div className="space-y-3">
              {/* Option 1: Soft Delete (Hide) */}
              <button
                type="button"
                onClick={() => handleDeleteSensor(false)}
                disabled={actionLoading}
                className="w-full text-left p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/40 transition-colors group"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
                  <EyeOff className="w-4 h-4" />
                  <span>Ausblenden (Empfohlen)</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Der Sensor wird aus den öffentlichen Dashboards entfernt.
                  Historische Telemetriedaten bleiben für Auswertungen erhalten.
                </p>
              </button>

              {/* Option 2: Hard Delete */}
              <button
                type="button"
                onClick={() => handleDeleteSensor(true)}
                disabled={actionLoading}
                className="w-full text-left p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500/40 transition-colors group"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-rose-400">
                  <Trash2 className="w-4 h-4" />
                  <span>Endgültig löschen & Daten bereinigen</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Löscht die Station und alle jemals aufgezeichneten
                  Telemetrie-Messpunkte unwiderruflich aus der Datenbank.
                </p>
              </button>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
