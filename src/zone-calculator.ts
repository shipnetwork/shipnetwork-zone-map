export type ServiceType = 'priority' | 'expedited' | 'ground';

export interface ServiceDefinition {
  id: ServiceType;
  label: string;
  tagline: string;
  days: string;
}

export const SERVICES: ServiceDefinition[] = [
  { id: 'priority',  label: 'Priority',  tagline: '1–3 Day',  days: '1–3' },
  { id: 'expedited', label: 'Expedited', tagline: '2–5 Day',  days: '2–5' },
  { id: 'ground',    label: 'Ground',    tagline: '3–8 Day',  days: '3–8' },
];

interface ZoneRange {
  min: number;
  max: number;
  zoneNumber: number;
  /** Default (ground) color */
  color: string;
  /** Color overrides per service type */
  colors: Record<ServiceType, string>;
  description: string;
  /** Days in transit per service */
  transitDays: Record<ServiceType, string>;
}

export class ZoneCalculator {
  private zoneRanges: ZoneRange[] = [
    {
      min: 0, max: 50, zoneNumber: 1,
      color: '#FFE4F6',
      colors:      { priority: '#FF9EDA', expedited: '#FFB8E6', ground: '#FFE4F6' },
      transitDays: { priority: '1 day',  expedited: '2 days',  ground: '3 days'  },
      description: 'Zone 1: 1-50 miles',
    },
    {
      min: 51, max: 150, zoneNumber: 2,
      color: '#8486FF',
      colors:      { priority: '#5557DD', expedited: '#7072FF', ground: '#8486FF' },
      transitDays: { priority: '1–2 days', expedited: '2 days',  ground: '3–4 days' },
      description: 'Zone 2: 51-150 miles',
    },
    {
      min: 151, max: 300, zoneNumber: 3,
      color: '#90C1FF',
      colors:      { priority: '#5599FF', expedited: '#70AAFF', ground: '#90C1FF' },
      transitDays: { priority: '2 days',  expedited: '2–3 days', ground: '4 days'  },
      description: 'Zone 3: 151-300 miles',
    },
    {
      min: 301, max: 600, zoneNumber: 4,
      color: '#A3FFFF',
      colors:      { priority: '#60EEEE', expedited: '#80F5F5', ground: '#A3FFFF' },
      transitDays: { priority: '2–3 days', expedited: '3 days',  ground: '4–5 days' },
      description: 'Zone 4: 301-600 miles',
    },
    {
      min: 601, max: 1000, zoneNumber: 5,
      color: '#A5FF8F',
      colors:      { priority: '#60EE40', expedited: '#80F560', ground: '#A5FF8F' },
      transitDays: { priority: '3 days',  expedited: '3–4 days', ground: '5–6 days' },
      description: 'Zone 5: 601-1,000 miles',
    },
    {
      min: 1001, max: 1400, zoneNumber: 6,
      color: '#FFFF90',
      colors:      { priority: '#FFFF40', expedited: '#FFFF65', ground: '#FFFF90' },
      transitDays: { priority: '3 days',  expedited: '4 days',  ground: '6–7 days' },
      description: 'Zone 6: 1,001-1,400 miles',
    },
    {
      min: 1401, max: 1800, zoneNumber: 7,
      color: '#FCC18A',
      colors:      { priority: '#FC9030', expedited: '#FCA860', ground: '#FCC18A' },
      transitDays: { priority: '3 days',  expedited: '4–5 days', ground: '7 days'  },
      description: 'Zone 7: 1,401-1,800 miles',
    },
    {
      min: 1801, max: Infinity, zoneNumber: 8,
      color: '#FC8A8A',
      colors:      { priority: '#FC4040', expedited: '#FC6060', ground: '#FC8A8A' },
      transitDays: { priority: '3 days',  expedited: '5 days',  ground: '7–8 days' },
      description: 'Zone 8: 1,801+ miles',
    },
  ];

  public getZoneRanges() {
    return this.zoneRanges;
  }

  /** Return the color to use for a given zone + service type */
  public getZoneColor(zoneNumber: number, service: ServiceType): string {
    const z = this.zoneRanges.find((r) => r.zoneNumber === zoneNumber);
    return z ? z.colors[service] : '#cccccc';
  }

  /** Return transit days label for a given zone + service type */
  public getTransitDays(zoneNumber: number, service: ServiceType): string {
    const z = this.zoneRanges.find((r) => r.zoneNumber === zoneNumber);
    return z ? z.transitDays[service] : '–';
  }

  public calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const radLat1 = (Math.PI * lat1) / 180;
    const radLon1 = (Math.PI * lon1) / 180;
    const radLat2 = (Math.PI * lat2) / 180;
    const radLon2 = (Math.PI * lon2) / 180;

    const dLon = radLon2 - radLon1;
    const dLat = radLat2 - radLat1;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 3959 * c; // miles
  }

  public calculateZone(distance: number) {
    for (const zone of this.zoneRanges) {
      if (distance >= zone.min && distance <= zone.max) {
        return zone;
      }
    }
    return this.zoneRanges[this.zoneRanges.length - 1];
  }
}
