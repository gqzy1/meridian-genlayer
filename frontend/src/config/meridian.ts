export type ClaimStatus = "ACTIVE" | "VERIFIED" | "REFUTED" | "INCONCLUSIVE";

export type ClaimCategory =
  | "PROTOCOL"
  | "GOVERNANCE"
  | "REGULATION"
  | "INFRASTRUCTURE"
  | "SCIENCE"
  | "PUBLIC_FACT";

export interface ClaimRecord {
  claim_id: string;
  title: string;
  category: ClaimCategory | string;
  region_label: string;
  lat_e4: number;
  lng_e4: number;
  criteria: string;
  primary_url: string;
  secondary_url: string;
  status: ClaimStatus;
  confidence: number;
  summary: string;
  evidence_excerpt: string;
  primary_status: string;
  secondary_status: string;
  submitter: string;
  last_adjudicator: string;
  adjudications: number;
}

export interface ClaimStats {
  total_claims: number;
  total_adjudications: number;
  active: number;
  verified: number;
  refuted: number;
  inconclusive: number;
}

export type TxLifecyclePhase =
  | "IDLE"
  | "SWITCHING_NETWORK"
  | "AWAITING_SIGNATURE"
  | "SUBMITTED"
  | "FETCHING_WEB"
  | "VALIDATORS_VOTING"
  | "FINALIZED"
  | "FAILED";

export const MERIDIAN_NETWORK = {
  chainId: 61999,
  chainIdHex: "0xf22f",
  chainName: "GenLayer StudioNet",
  rpcUrl: "https://studio.genlayer.com/api",
  explorerUrl: "https://explorer-studio.genlayer.com",
  nativeCurrency: {
    name: "GEN",
    symbol: "GEN",
    decimals: 18,
  },
} as const;

export const MERIDIAN_CONTRACT_ADDRESS =
  "0xFF227A2317bF3E700F9A2d42dA835399367f143D" as `0x${string}`;

export const MERIDIAN_DEPLOYED = !/^0x0{40}$/.test(MERIDIAN_CONTRACT_ADDRESS);

export const ALLOWED_CATEGORIES: ClaimCategory[] = [
  "PROTOCOL",
  "GOVERNANCE",
  "REGULATION",
  "INFRASTRUCTURE",
  "SCIENCE",
  "PUBLIC_FACT",
];

export interface PresetLocation {
  label: string;
  lat: number;
  lng: number;
}

export const PRESET_LOCATIONS: PresetLocation[] = [
  { label: "Zurich, CH", lat: 47.3769, lng: 8.5417 },
  { label: "San Francisco, US", lat: 37.7749, lng: -122.4194 },
  { label: "Tokyo, JP", lat: 35.6762, lng: 139.6503 },
  { label: "Singapore, SG", lat: 1.3521, lng: 103.8198 },
  { label: "London, UK", lat: 51.5072, lng: -0.1276 },
  { label: "New York, US", lat: 40.7128, lng: -74.006 },
];

export const VALIDATOR_HUBS = [
  { id: "V1", city: "Zurich", lat: 47.37, lng: 8.54 },
  { id: "V2", city: "New York", lat: 40.71, lng: -74.0 },
  { id: "V3", city: "Tokyo", lat: 35.68, lng: 139.65 },
  { id: "V4", city: "Singapore", lat: 1.35, lng: 103.82 },
  { id: "V5", city: "Sao Paulo", lat: -23.55, lng: -46.63 },
] as const;

export function formatShortAddress(address: string): string {
  if (!address || address.length < 10) return address || "—";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatCoords(latE4: number, lngE4: number): string {
  const lat = latE4 / 10000;
  const lng = lngE4 / 10000;
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lng).toFixed(2)}°${ew}`;
}
