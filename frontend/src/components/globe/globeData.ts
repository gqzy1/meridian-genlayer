import type { ClaimStatus } from "../../config/meridian";

export type LatLngTuple = [number, number];

// Simplified continent contours [lat, lng] for luminous holographic relief on the sapphire crystal globe
export const CONTINENT_POLYGONS: LatLngTuple[][] = [
  // North America
  [
    [70, -162], [71, -135], [68, -95], [60, -64], [47, -53], [43, -70],
    [35, -75], [25, -80], [29, -89], [20, -97], [14, -84], [8, -78],
    [16, -95], [23, -106], [32, -117], [48, -125], [60, -148], [66, -165],
  ],
  // Greenland
  [
    [82, -32], [76, -18], [65, -38], [60, -44], [69, -54], [78, -68], [82, -52],
  ],
  // South America
  [
    [11, -74], [10, -61], [1, -50], [-6, -35], [-22, -41], [-35, -54],
    [-54, -68], [-52, -75], [-34, -72], [-18, -71], [-5, -81], [5, -77],
  ],
  // Europe
  [
    [36, -9], [43, -9], [48, -4], [54, 8], [60, 5], [70, 22], [68, 42],
    [56, 38], [46, 31], [41, 28], [38, 22], [44, 13], [41, 1],
  ],
  // Africa
  [
    [36, -6], [37, 10], [31, 32], [20, 38], [11, 51], [1, 42], [-14, 40],
    [-34, 25], [-34, 18], [-17, 11], [-4, 11], [5, 2], [5, -8], [15, -17], [28, -13],
  ],
  // Asia
  [
    [42, 28], [55, 42], [68, 60], [73, 105], [70, 145], [65, 175],
    [54, 140], [42, 131], [35, 129], [31, 121], [22, 114], [11, 109],
    [2, 103], [16, 97], [22, 90], [8, 77], [23, 68], [26, 56], [13, 44], [30, 34],
  ],
  // Australia
  [
    [-12, 131], [-12, 142], [-25, 153], [-38, 148], [-35, 136],
    [-34, 115], [-22, 114], [-15, 124],
  ],
  // UK & Ireland
  [
    [58, -5], [58, -1], [51, 1], [50, -5], [54, -6],
  ],
  // Japan
  [
    [44, 145], [40, 141], [35, 140], [31, 131], [34, 132], [39, 139],
  ],
  // Madagascar
  [
    [-12, 49], [-16, 50], [-25, 47], [-25, 44], [-16, 45],
  ],
  // New Zealand
  [
    [-35, 173], [-38, 178], [-46, 169], [-45, 166], [-40, 172],
  ],
];

// Point-in-polygon helper to precompute crisp holographic dot-matrix landmass points once at startup
function pointInPoly(lat: number, lng: number, poly: LatLngTuple[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0];
    const xi = poly[i][1];
    const yj = poly[j][0];
    const xj = poly[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function buildLandmassDots(): LatLngTuple[] {
  const dots: LatLngTuple[] = [];
  for (let lat = -54; lat <= 78; lat += 4.5) {
    const stepLng = Math.max(4.5, 4.8 / Math.max(0.28, Math.cos((lat * Math.PI) / 180)));
    for (let lng = -175; lng <= 178; lng += stepLng) {
      for (let p = 0; p < CONTINENT_POLYGONS.length; p++) {
        if (pointInPoly(lat, lng, CONTINENT_POLYGONS[p])) {
          dots.push([lat, lng]);
          break;
        }
      }
    }
  }
  return dots;
}

export const LANDMASS_DOTS: LatLngTuple[] = buildLandmassDots();

// Subtle geodesic constellation backbone pairs linking the 5 global validator hubs
export const VALIDATOR_MESH_PAIRS: Array<[number, number]> = [
  [0, 1], // Zurich <-> New York
  [0, 2], // Zurich <-> Tokyo
  [0, 3], // Zurich <-> Singapore
  [1, 4], // New York <-> Sao Paulo
  [2, 3], // Tokyo <-> Singapore
  [3, 4], // Singapore <-> Sao Paulo
  [0, 4], // Zurich <-> Sao Paulo
];

export interface BeaconVisualStyle {
  core: string;
  mid: string;
  glow: string;
  ring: string;
  badgeText: string;
}

export const BEACON_STYLES: Record<ClaimStatus | "ADJUDICATING", BeaconVisualStyle> = {
  ACTIVE: {
    core: "#E0F7FF",
    mid: "#38BDF8",
    glow: "rgba(56, 189, 248, 0.72)",
    ring: "rgba(125, 211, 252, 0.92)",
    badgeText: "#E0F2FE",
  },
  ADJUDICATING: {
    core: "#FEF3C7",
    mid: "#F59E0B",
    glow: "rgba(251, 191, 36, 0.78)",
    ring: "rgba(253, 224, 71, 0.94)",
    badgeText: "#FEF3C7",
  },
  VERIFIED: {
    core: "#D1FAE5",
    mid: "#10B981",
    glow: "rgba(16, 185, 129, 0.75)",
    ring: "rgba(110, 231, 183, 0.92)",
    badgeText: "#D1FAE5",
  },
  REFUTED: {
    core: "#FFE4E6",
    mid: "#F43F5E",
    glow: "rgba(244, 63, 94, 0.72)",
    ring: "rgba(253, 164, 175, 0.92)",
    badgeText: "#FFE4E6",
  },
  INCONCLUSIVE: {
    core: "#F1F5F9",
    mid: "#94A3B8",
    glow: "rgba(148, 163, 184, 0.6)",
    ring: "rgba(226, 232, 240, 0.85)",
    badgeText: "#F1F5F9",
  },
};
