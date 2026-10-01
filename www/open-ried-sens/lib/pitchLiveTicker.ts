export interface LiveRegionalMetrics {
  elapsedSeconds: number;
  formattedDuration: string;
  binsEmptied: number;
  levelCrossingEvents: number;
  trainsTraversed: number;
  telemetryPackets: number;
  parkingStateChanges: number;
  solarKwhGenerated: string;
  waterEvaporatedLiters: number;
  co2Measurements: number;
  pm25Samples: number;
}

export function calculateLiveRegionalMetrics(elapsedSeconds: number): LiveRegionalMetrics {
  const safeSeconds = Math.max(1, elapsedSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  const formattedDuration = `${minutes > 0 ? `${minutes} Min. ` : ""}${seconds} Sek.`;

  // Realistic regional rates for the Hessische Ried (approx. 55.000 inhabitants):
  // - ZAKB waste collection: ~1 bin every 2.2 seconds during daily rounds across Bürstadt, Lampertheim, Biblis
  const binsEmptied = Math.max(3, Math.floor(safeSeconds * 0.45));

  // - Riedbahn & Nibelungenbahn: Level crossing closures / reopenings (~1 event every 15-20 sec)
  const levelCrossingEvents = Math.max(1, Math.floor(safeSeconds * 0.065));

  // - Train crossings: high speed ICE, RE70, RB63, cargo (~1 train corridor transit every 30-40 sec)
  const trainsTraversed = Math.max(1, Math.floor(safeSeconds * 0.03));

  // - LoRaWAN IoT packets received (weather, air, soil): ~3.2 packets/sec
  const telemetryPackets = Math.max(8, Math.floor(safeSeconds * 3.2));

  // - Parking spot state changes in Bürstadt (smartcity-system.de): ~1 change every 5 sec
  const parkingStateChanges = Math.max(2, Math.floor(safeSeconds * 0.2));

  // - Solar energy generated in the Ried corridor
  const solarKwhGenerated = (safeSeconds * 0.16).toFixed(1);

  // - Soil / groundwater moisture samples: ~1.5 per sec
  const waterEvaporatedLiters = Math.max(5, Math.floor(safeSeconds * 1.4));

  // - CO2 & PM2.5 samples
  const co2Measurements = Math.max(4, Math.floor(safeSeconds * 1.1));
  const pm25Samples = Math.max(4, Math.floor(safeSeconds * 1.3));

  return {
    elapsedSeconds: safeSeconds,
    formattedDuration,
    binsEmptied,
    levelCrossingEvents,
    trainsTraversed,
    telemetryPackets,
    parkingStateChanges,
    solarKwhGenerated,
    waterEvaporatedLiters,
    co2Measurements,
    pm25Samples,
  };
}
