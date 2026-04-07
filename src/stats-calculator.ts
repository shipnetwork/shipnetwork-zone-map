import type { Warehouse } from './warehouses';
import { ZoneCalculator, type ServiceType } from './zone-calculator';

export interface WarehouseStats {
  warehouseId: string;
  warehouseName: string;
  avgZone: number;
  avgTransitDays: string;
}

export interface NetworkStats {
  avgZone: number;
  avgTransitDays: string;
  savingsVsSingleDC: number; // percentage improvement vs best single DC
  perWarehouse: WarehouseStats[];
}

/**
 * ~50 representative US population-center coordinates.
 * Replace this array with real customer destination data when available —
 * no other code changes needed.
 */
export const SAMPLE_DESTINATIONS: [number, number][] = [
  // [lat, lng]
  [40.7128, -74.0060],   // New York, NY
  [34.0522, -118.2437],  // Los Angeles, CA
  [41.8781, -87.6298],   // Chicago, IL
  [29.7604, -95.3698],   // Houston, TX
  [33.4484, -112.0740],  // Phoenix, AZ
  [39.9526, -75.1652],   // Philadelphia, PA
  [29.4241, -98.4936],   // San Antonio, TX
  [32.7767, -96.7970],   // Dallas, TX
  [30.3322, -81.6557],   // Jacksonville, FL
  [30.2672, -97.7431],   // Austin, TX
  [30.3960, -86.4760],   // Fort Walton Beach, FL
  [37.3382, -121.8863],  // San Jose, CA
  [32.7157, -117.1611],  // San Diego, CA
  [30.0082, -90.1199],   // New Orleans, LA
  [35.4676, -97.5164],   // Oklahoma City, OK
  [36.1627, -86.7816],   // Nashville, TN
  [35.2271, -80.8431],   // Charlotte, NC
  [36.1540, -95.9928],   // Tulsa, OK
  [39.7392, -104.9903],  // Denver, CO
  [36.1745, -115.1372],  // Las Vegas, NV
  [47.6062, -122.3321],  // Seattle, WA
  [45.5231, -122.6765],  // Portland, OR
  [38.2527, -85.7585],   // Louisville, KY
  [35.1495, -90.0490],   // Memphis, TN
  [43.0481, -76.1474],   // Syracuse, NY
  [42.3601, -71.0589],   // Boston, MA
  [39.7684, -86.1581],   // Indianapolis, IN
  [43.0481, -76.1474],   // Syracuse, NY
  [38.8951, -77.0369],   // Washington, DC
  [25.7617, -80.1918],   // Miami, FL
  [27.9506, -82.4572],   // Tampa, FL
  [28.5383, -81.3792],   // Orlando, FL
  [33.7490, -84.3880],   // Atlanta, GA
  [35.7796, -78.6382],   // Raleigh, NC
  [37.5407, -77.4360],   // Richmond, VA
  [39.2904, -76.6122],   // Baltimore, MD
  [40.4406, -79.9959],   // Pittsburgh, PA
  [41.4993, -81.6944],   // Cleveland, OH
  [39.9612, -82.9988],   // Columbus, OH
  [42.3314, -83.0458],   // Detroit, MI
  [44.9778, -93.2650],   // Minneapolis, MN
  [41.2565, -95.9345],   // Omaha, NE
  [39.0997, -94.5786],   // Kansas City, MO
  [38.6270, -90.1994],   // St. Louis, MO
  [46.8772, -96.7898],   // Fargo, ND
  [43.5460, -96.7313],   // Sioux Falls, SD
  [41.7000, -91.5300],   // Iowa City, IA
  [43.0731, -89.4012],   // Madison, WI
  [44.5133, -88.0133],   // Green Bay, WI
  [46.7867, -92.1005],   // Duluth, MN
  [35.6870, -105.9378],  // Santa Fe, NM
  [35.0844, -106.6504],  // Albuquerque, NM
  [32.4487, -99.7331],   // Abilene, TX
];

export function calculateNetworkStats(
  selectedWarehouses: Warehouse[],
  service: ServiceType,
  calc: ZoneCalculator
): NetworkStats | null {
  if (selectedWarehouses.length === 0) return null;

  // For each sample destination, find the minimum zone from any selected warehouse
  const destZones = SAMPLE_DESTINATIONS.map(([lat, lng]) => {
    let minZone = Infinity;
    selectedWarehouses.forEach((wh) => {
      const dist = calc.calculateDistance(wh.coordinates[1], wh.coordinates[0], lat, lng);
      const zone = calc.calculateZone(dist);
      minZone = Math.min(minZone, zone.zoneNumber);
    });
    return minZone;
  });

  const avgZone = destZones.reduce((a, b) => a + b, 0) / destZones.length;

  // Per-warehouse stats (each warehouse alone)
  const perWarehouse: WarehouseStats[] = selectedWarehouses.map((wh) => {
    const zones = SAMPLE_DESTINATIONS.map(([lat, lng]) => {
      const dist = calc.calculateDistance(wh.coordinates[1], wh.coordinates[0], lat, lng);
      return calc.calculateZone(dist).zoneNumber;
    });
    const whAvgZone = zones.reduce((a, b) => a + b, 0) / zones.length;
    return {
      warehouseId: wh.id,
      warehouseName: `${wh.city}, ${wh.state}`,
      avgZone: Math.round(whAvgZone * 10) / 10,
      avgTransitDays: getTransitDaysLabel(whAvgZone, service),
    };
  });

  // Savings vs best single DC
  const bestSingleAvg = Math.min(...perWarehouse.map((w) => w.avgZone));
  const savingsVsSingleDC =
    selectedWarehouses.length > 1
      ? Math.round(((bestSingleAvg - avgZone) / bestSingleAvg) * 100)
      : 0;

  return {
    avgZone: Math.round(avgZone * 10) / 10,
    avgTransitDays: getTransitDaysLabel(avgZone, service),
    savingsVsSingleDC: Math.max(0, savingsVsSingleDC),
    perWarehouse,
  };
}

function getTransitDaysLabel(avgZone: number, service: ServiceType): string {
  const transitTable: Record<ServiceType, [number, string][]> = {
    priority:  [[2, '1 day'], [3.5, '1–2 days'], [5, '2–3 days'], [Infinity, '3 days']],
    expedited: [[2, '2 days'], [3.5, '2–3 days'], [5.5, '3–4 days'], [Infinity, '4–5 days']],
    ground:    [[2, '3 days'], [3.5, '3–4 days'], [5, '4–5 days'], [6.5, '5–6 days'], [Infinity, '6–8 days']],
  };
  for (const [threshold, label] of transitTable[service]) {
    if (avgZone <= threshold) return label;
  }
  return '–';
}
