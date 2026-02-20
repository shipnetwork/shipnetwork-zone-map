export interface Warehouse {
  id: string;
  name: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates: [number, number]; // [longitude, latitude]
  markerColor: string;
}

export const WAREHOUSES: Warehouse[] = [
  {
    id: 'anaheim',
    name: 'Anaheim',
    city: 'Anaheim',
    state: 'CA',
    zipCode: '92805',
    coordinates: [-117.9145, 33.8353],
    markerColor: '#FF6B6B',
  },
  {
    id: 'las-vegas',
    name: 'Las Vegas',
    city: 'Las Vegas',
    state: 'NV',
    zipCode: '89101',
    coordinates: [-115.1398, 36.1699],
    markerColor: '#4ECDC4',
  },
  {
    id: 'reno',
    name: 'Reno',
    city: 'Reno',
    state: 'NV',
    zipCode: '89501',
    coordinates: [-119.8138, 39.5296],
    markerColor: '#45B7D1',
  },
  {
    id: 'salt-lake-city',
    name: 'Salt Lake City',
    city: 'Salt Lake City',
    state: 'UT',
    zipCode: '84101',
    coordinates: [-111.891, 40.7608],
    markerColor: '#96CEB4',
  },
  {
    id: 'chicago',
    name: 'Chicago',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60601',
    coordinates: [-87.6298, 41.8781],
    markerColor: '#FFEAA7',
  },
  {
    id: 'houston',
    name: 'Houston',
    city: 'Houston',
    state: 'TX',
    zipCode: '77001',
    coordinates: [-95.3698, 29.7604],
    markerColor: '#DFE6E9',
  },
  {
    id: 'atlanta',
    name: 'Atlanta',
    city: 'Atlanta',
    state: 'GA',
    zipCode: '30301',
    coordinates: [-84.388, 33.749],
    markerColor: '#74B9FF',
  },
  {
    id: 'olean',
    name: 'Olean',
    city: 'Olean',
    state: 'NY',
    zipCode: '14760',
    coordinates: [-78.4297, 42.0784],
    markerColor: '#A29BFE',
  },
  {
    id: 'scranton',
    name: 'Scranton',
    city: 'Scranton',
    state: 'PA',
    zipCode: '18501',
    coordinates: [-75.6624, 41.4090],
    markerColor: '#FD79A8',
  },
  {
    id: 'west-hazleton',
    name: 'West Hazleton',
    city: 'West Hazleton',
    state: 'PA',
    zipCode: '18202',
    coordinates: [-75.9946, 40.9587],
    markerColor: '#FDCB6E',
  },
];
