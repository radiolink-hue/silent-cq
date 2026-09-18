// Maidenhead locator <-> latitude/longitude helpers and great-circle distance.

export function gridToLatLng(grid: string): { lat: number; lng: number } | null {
  const g = grid.trim().toUpperCase();
  if (!/^[A-R]{2}[0-9]{2}([A-X]{2})?$/.test(g)) return null;

  let lng = (g.charCodeAt(0) - 65) * 20 - 180;
  let lat = (g.charCodeAt(1) - 65) * 10 - 90;
  lng += parseInt(g[2], 10) * 2;
  lat += parseInt(g[3], 10) * 1;

  if (g.length === 6) {
    lng += (g.charCodeAt(4) - 65) * (2 / 24);
    lat += (g.charCodeAt(5) - 65) * (1 / 24);
    lng += 2 / 24 / 2;
    lat += 1 / 24 / 2;
  } else {
    lng += 1;
    lat += 0.5;
  }
  return { lat, lng };
}

export function latLngToGrid(lat: number, lng: number): string {
  const adjLng = lng + 180;
  const adjLat = lat + 90;

  const field1 = String.fromCharCode(65 + Math.floor(adjLng / 20));
  const field2 = String.fromCharCode(65 + Math.floor(adjLat / 10));
  const square1 = Math.floor((adjLng % 20) / 2);
  const square2 = Math.floor(adjLat % 10);
  const sub1 = String.fromCharCode(
    97 + Math.floor(((adjLng % 2) / 2) * 24)
  );
  const sub2 = String.fromCharCode(
    97 + Math.floor((adjLat % 1) * 24)
  );
  return `${field1}${field2}${square1}${square2}${sub1}${sub2}`;
}

export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}
