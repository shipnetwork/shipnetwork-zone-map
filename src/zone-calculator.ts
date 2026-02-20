interface ZoneRange {
  min: number;
  max: number;
  zoneNumber: number;
  color: string;
  description: string;
}

export class ZoneCalculator {
  private zoneRanges = [
    { min: 0, max: 50, zoneNumber: 1, color: '#FFE4F6', description: 'Zone 1: 1-50 miles' },
    { min: 51, max: 150, zoneNumber: 2, color: '#8486FF', description: 'Zone 2: 51-150 miles' },
    { min: 151, max: 300, zoneNumber: 3, color: '#90C1FF', description: 'Zone 3: 151-300 miles' },
    { min: 301, max: 600, zoneNumber: 4, color: '#A3FFFF', description: 'Zone 4: 301-600 miles' },
    {
      min: 601,
      max: 1000,
      zoneNumber: 5,
      color: '#A5FF8F',
      description: 'Zone 5: 601-1,000 miles',
    },
    {
      min: 1001,
      max: 1400,
      zoneNumber: 6,
      color: '#FFFF90',
      description: 'Zone 6: 1,001-1,400 miles',
    },
    {
      min: 1401,
      max: 1800,
      zoneNumber: 7,
      color: '#FCC18A',
      description: 'Zone 7: 1,401-1,800 miles',
    },
    {
      min: 1801,
      max: Infinity,
      zoneNumber: 8,
      color: '#FC8A8A',
      description: 'Zone 8: 1,801+ miles',
    },
  ];

  public getZoneRanges() {
    return this.zoneRanges;
  }

  public calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Convert latitude and longitude from degrees to radians
    const radLat1 = (Math.PI * lat1) / 180;
    const radLon1 = (Math.PI * lon1) / 180;
    const radLat2 = (Math.PI * lat2) / 180;
    const radLon2 = (Math.PI * lon2) / 180;

    // Haversine formula
    const dLon = radLon2 - radLon1;
    const dLat = radLat2 - radLat1;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Radius of the Earth in miles
    const radius = 3959;

    // Calculate the distance
    return radius * c;
  }

  public calculateZone(distance: number) {
    for (const zone of this.zoneRanges) {
      if (distance >= zone.min && distance <= zone.max) {
        return zone;
      }
    }
    return this.zoneRanges[this.zoneRanges.length - 1]; // Default to the highest zone
  }
}
