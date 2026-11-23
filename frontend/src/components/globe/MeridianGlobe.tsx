import React, { useEffect, useRef } from "react";
import {
  VALIDATOR_HUBS,
  type ClaimRecord,
  type ClaimStatus,
} from "../../config/meridian";
import { crystalAudio } from "../../utils/crystalAudio";
import {
  BEACON_STYLES,
  CONTINENT_POLYGONS,
  LANDMASS_DOTS,
  VALIDATOR_MESH_PAIRS,
} from "./globeData";
import { EarthRenderer, type GlobeTheme } from "./EarthRenderer";

export type { GlobeTheme };

export interface ShockwaveSignal {
  claimId: string;
  status: ClaimStatus;
  seq: number;
}

export interface GlobeCommand {
  type: "ZOOM_IN" | "ZOOM_OUT" | "RESET" | "SONAR" | "FOCUS_COORDS";
  lat?: number;
  lng?: number;
  seq: number;
}

export interface DemoVisualState {
  active: boolean;
  step: number; // 0..3
  lat: number;
  lng: number;
  label: string;
}

export interface HoveredBeaconInfo {
  claim: ClaimRecord;
  x: number;
  y: number;
}

export interface MeridianGlobeProps {
  claims: ClaimRecord[];
  selectedClaimId: string | null;
  selectedValidatorId: string | null;
  adjudicatingClaimId: string | null;
  adjudicationStage: number; // 0..5
  shockwaveSignal: ShockwaveSignal | null;
  globeCommand: GlobeCommand | null;
  demoVisual: DemoVisualState | null;
  globeTheme: GlobeTheme;
  showClouds: boolean;
  autoSpin: boolean;
  pureOrbit: boolean;
  pinMode: boolean;
  pinnedCoords: { lat: number; lng: number } | null;
  onSelectClaim: (claimId: string) => void;
  onSelectValidator: (validatorId: string | null) => void;
  onHoverBeacon: (info: HoveredBeaconInfo | null) => void;
  onCursorCoords: (coords: { lat: number; lng: number } | null) => void;
  onPinCoords: (coords: { lat: number; lng: number }) => void;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  z: number;
}

interface RibbonLayer {
  isFront: boolean;
  baseOffset: number;
  widthScale: number;
  speed: number;
  phase: number;
  alpha: number;
  tint: [number, number, number];
  dy: Float32Array;
  vy: Float32Array;
}

interface SpatialRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  lineWidth: number;
}

interface ScreenBeacon {
  claim: ClaimRecord;
  x: number;
  y: number;
  z: number;
}

interface ScreenValidator {
  id: string;
  city: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
  z: number;
}

interface TransientPulseArc {
  from: Vec3;
  to: Vec3;
  bornAt: number;
  duration: number;
  color: string;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const RIBBON_SAMPLES = 46;

function latLngToUnit(latDeg: number, lngDeg: number): Vec3 {
  const lat = latDeg * DEG2RAD;
  const lng = lngDeg * DEG2RAD;
  const cosLat = Math.cos(lat);
  return {
    x: cosLat * Math.sin(lng),
    y: -Math.sin(lat),
    z: cosLat * Math.cos(lng),
  };
}

const PRECOMPUTED_DOT_UNITS: Vec3[] = LANDMASS_DOTS.map(([lat, lng]) =>
  latLngToUnit(lat, lng)
);

const PRECOMPUTED_HUB_UNITS: Vec3[] = VALIDATOR_HUBS.map((h) =>
  latLngToUnit(h.lat, h.lng)
);

function rotatePoint(p: Vec3, rotY: number, rotX: number): Vec3 {
  const cy = Math.cos(rotY);
  const sy = Math.sin(rotY);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;

  const cx = Math.cos(rotX);
  const sx = Math.sin(rotX);
  const y2 = p.y * cx - z1 * sx;
  const z2 = p.y * sx + z1 * cx;

  return { x: x1, y: y2, z: z2 };
}

function screenToLatLng(
  sx: number,
  sy: number,
  cx: number,
  cy: number,
  radius: number,
  rotY: number,
  rotX: number
): { lat: number; lng: number } | null {
  const nx = (sx - cx) / radius;
  const ny = (sy - cy) / radius;
  const r2 = nx * nx + ny * ny;
  if (r2 > 0.995) return null;

  const nz = Math.sqrt(Math.max(0, 1 - r2));
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y1 = ny * cosX + nz * sinX;
  const z1 = -ny * sinX + nz * cosX;

  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x0 = nx * cosY - z1 * sinY;
  const z0 = nx * sinY + z1 * cosY;

  const lat = Math.asin(Math.max(-1, Math.min(1, -y1))) * RAD2DEG;
  const lng = Math.atan2(x0, z0) * RAD2DEG;
  return { lat, lng };
}

function createRibbons(): RibbonLayer[] {
  const configs: Array<{
    isFront: boolean;
    baseOffset: number;
    widthScale: number;
    speed: number;
    phase: number;
    alpha: number;
    tint: [number, number, number];
  }> = [
    { isFront: false, baseOffset: -0.095, widthScale: 1.35, speed: 0.55, phase: 0.4, alpha: 0.44, tint: [56, 165, 220] },
    { isFront: false, baseOffset: 0.085, widthScale: 1.15, speed: 0.48, phase: 2.1, alpha: 0.4, tint: [72, 182, 232] },
    { isFront: true, baseOffset: -0.082, widthScale: 1.05, speed: 0.72, phase: 0.0, alpha: 0.62, tint: [42, 174, 224] },
    { isFront: true, baseOffset: -0.03, widthScale: 1.35, speed: 0.85, phase: 1.15, alpha: 0.74, tint: [24, 158, 216] },
    { isFront: true, baseOffset: 0.016, widthScale: 1.48, speed: 0.68, phase: 2.35, alpha: 0.78, tint: [56, 198, 236] },
    { isFront: true, baseOffset: 0.064, widthScale: 1.16, speed: 0.92, phase: 3.4, alpha: 0.68, tint: [38, 172, 224] },
    { isFront: true, baseOffset: 0.112, widthScale: 0.9, speed: 0.62, phase: 4.5, alpha: 0.54, tint: [86, 206, 238] },
  ];

  return configs.map((cfg) => ({
    ...cfg,
    dy: new Float32Array(RIBBON_SAMPLES),
    vy: new Float32Array(RIBBON_SAMPLES),
  }));
}

function slerpUnit(a: Vec3, b: Vec3, t: number): Vec3 {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const omega = Math.acos(dot);
  if (omega < 0.001) {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  }
  const sinO = Math.sin(omega);
  const wA = Math.sin((1 - t) * omega) / sinO;
  const wB = Math.sin(t * omega) / sinO;
  return {
    x: a.x * wA + b.x * wB,
    y: a.y * wA + b.y * wB,
    z: a.z * wA + b.z * wB,
  };
}

function drawRoundedPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export const MeridianGlobe: React.FC<MeridianGlobeProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const earthRendererRef = useRef<EarthRenderer | null>(null);
  const propsRef = useRef<MeridianGlobeProps>(props);
  propsRef.current = props;

  const stateRef = useRef({
    width: 1280,
    height: 720,
    dpr: 1,
    centerXRatio: 0.41,
    rotY: -0.32,
    rotX: -0.34,
    velY: 0,
    velX: 0,
    targetRotY: null as number | null,
    targetRotX: null as number | null,
    zoom: 1,
    targetZoom: 1,
    dragging: false,
    lastPointerX: 0,
    lastPointerY: 0,
    dragDistance: 0,
    mouseX: -9999,
    mouseY: -9999,
    mouseVx: 0,
    mouseVy: 0,
    hoveredClaimId: null as string | null,
    hoveredValidatorId: null as string | null,
    ribbons: createRibbons(),
    ripples: [] as SpatialRipple[],
    pulseArcs: [] as TransientPulseArc[],
    screenBeacons: [] as ScreenBeacon[],
    screenValidators: [] as ScreenValidator[],
    lastShockSeq: 0,
    lastCommandSeq: 0,
    lastCoordEmitMs: 0,
  });

  const focusOnLatLng = (lat: number, lng: number) => {
    const st = stateRef.current;
    const desiredY = -lng * DEG2RAD;
    const deltaY = Math.atan2(
      Math.sin(desiredY - st.rotY),
      Math.cos(desiredY - st.rotY)
    );
    st.targetRotY = st.rotY + deltaY;
    st.targetRotX = Math.max(-0.82, Math.min(0.82, -lat * DEG2RAD * 0.72));
    st.velX = 0;
    st.velY = 0;
  };

  const exciteRibbonsNear = (sx: number, strength: number) => {
    const st = stateRef.current;
    st.ribbons.forEach((ribbon, rIdx) => {
      for (let i = 0; i < RIBBON_SAMPLES; i++) {
        const t = i / (RIBBON_SAMPLES - 1);
        const rx = (-0.1 + t * 1.2) * st.width;
        const dist = Math.abs(rx - sx);
        if (dist < 360) {
          const factor = 1 - dist / 360;
          const dir = rIdx % 2 === 0 ? -1 : 1;
          ribbon.vy[i] += dir * factor * strength;
        }
      }
    });
  };

  // Cinematic orbit cruise when selectedClaimId changes
  useEffect(() => {
    if (!props.selectedClaimId || props.demoVisual?.active) return;
    const claim = props.claims.find((c) => c.claim_id === props.selectedClaimId);
    if (!claim) return;
    focusOnLatLng(claim.lat_e4 / 10000, claim.lng_e4 / 10000);
  }, [props.selectedClaimId, props.claims, props.demoVisual?.active]);

  // Focus on demo location when Interactive Walkthrough activates
  useEffect(() => {
    if (!props.demoVisual?.active) return;
    focusOnLatLng(props.demoVisual.lat, props.demoVisual.lng);
  }, [props.demoVisual?.active, props.demoVisual?.lat, props.demoVisual?.lng]);

  // Execute external Globe HUD commands
  useEffect(() => {
    const cmd = props.globeCommand;
    if (!cmd || cmd.seq === stateRef.current.lastCommandSeq) return;
    stateRef.current.lastCommandSeq = cmd.seq;

    const st = stateRef.current;
    if (cmd.type === "ZOOM_IN") {
      st.targetZoom = Math.min(1.24, st.targetZoom + 0.12);
    } else if (cmd.type === "ZOOM_OUT") {
      st.targetZoom = Math.max(0.82, st.targetZoom - 0.12);
    } else if (cmd.type === "RESET") {
      st.targetZoom = 1;
      st.targetRotY = -0.32;
      st.targetRotX = -0.34;
    } else if (
      cmd.type === "FOCUS_COORDS" &&
      cmd.lat !== undefined &&
      cmd.lng !== undefined
    ) {
      focusOnLatLng(cmd.lat, cmd.lng);
      const cx = st.width * st.centerXRatio;
      const cy = st.height * 0.54;
      st.ripples.push({
        x: cx,
        y: cy,
        radius: 16,
        maxRadius: Math.min(st.width, st.height) * 0.44,
        alpha: 0.78,
        color: "#38BDF8",
        lineWidth: 2,
      });
      exciteRibbonsNear(cx, 8.5);
    } else if (cmd.type === "SONAR") {
      const cx = st.width * st.centerXRatio;
      const cy = st.height * 0.54;
      crystalAudio.playRipple();
      st.ripples.push(
        {
          x: cx,
          y: cy,
          radius: 14,
          maxRadius: Math.min(st.width, st.height) * 0.55,
          alpha: 0.85,
          color: "#38BDF8",
          lineWidth: 2.2,
        },
        {
          x: cx,
          y: cy,
          radius: 8,
          maxRadius: Math.min(st.width, st.height) * 0.36,
          alpha: 0.72,
          color: "#E0F2FE",
          lineWidth: 1.5,
        }
      );
      exciteRibbonsNear(cx, 11);
      const now = performance.now() * 0.001;
      VALIDATOR_MESH_PAIRS.slice(0, 4).forEach(([a, b], idx) => {
        st.pulseArcs.push({
          from: PRECOMPUTED_HUB_UNITS[a],
          to: PRECOMPUTED_HUB_UNITS[b],
          bornAt: now + idx * 0.12,
          duration: 1.6,
          color: "#38BDF8",
        });
      });
    }
  }, [props.globeCommand]);

  // Optical shockwave on finality
  useEffect(() => {
    const sig = props.shockwaveSignal;
    if (!sig || sig.seq === stateRef.current.lastShockSeq) return;
    stateRef.current.lastShockSeq = sig.seq;

    const st = stateRef.current;
    const found = st.screenBeacons.find((b) => b.claim.claim_id === sig.claimId);
    const sx = found ? found.x : st.width * st.centerXRatio;
    const sy = found ? found.y : st.height * 0.54;
    const palette = BEACON_STYLES[sig.status] ?? BEACON_STYLES.VERIFIED;

    st.ripples.push(
      {
        x: sx,
        y: sy,
        radius: 12,
        maxRadius: Math.max(st.width, st.height) * 0.44,
        alpha: 0.92,
        color: palette.mid,
        lineWidth: 2.8,
      },
      {
        x: sx,
        y: sy,
        radius: 6,
        maxRadius: Math.max(st.width, st.height) * 0.3,
        alpha: 0.82,
        color: "#FFFFFF",
        lineWidth: 1.9,
      }
    );

    exciteRibbonsNear(sx, 15.5);
    crystalAudio.playConsensusFinalized(sig.status);
  }, [props.shockwaveSignal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const earthRenderer = new EarthRenderer();
    earthRendererRef.current = earthRenderer;

    let rafId = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      stateRef.current.width = w;
      stateRef.current.height = h;
      stateRef.current.dpr = dpr;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const computeRibbonBaseY = (
      t: number,
      h: number,
      time: number,
      ribbon: RibbonLayer
    ): number => {
      const sweep =
        h * 0.74 -
        t * h * 0.44 +
        Math.sin(t * Math.PI * 1.45 - 0.55) * h * 0.145;
      const travelWave =
        Math.sin(t * 5.2 - time * ribbon.speed + ribbon.phase) * 18 +
        Math.cos(t * 2.8 + time * 0.45 + ribbon.phase) * 9;
      return sweep + ribbon.baseOffset * h + travelWave;
    };

    const drawRibbon = (
      ribbon: RibbonLayer,
      w: number,
      h: number,
      time: number,
      opacityMult: number
    ) => {
      const upperX: number[] = [];
      const upperY: number[] = [];
      const lowerX: number[] = [];
      const lowerY: number[] = [];

      for (let i = 0; i < RIBBON_SAMPLES; i++) {
        const t = i / (RIBBON_SAMPLES - 1);
        const x = (-0.1 + t * 1.2) * w;
        const y = computeRibbonBaseY(t, h, time, ribbon) + ribbon.dy[i];
        const bell = Math.sin(t * Math.PI);
        const halfW = (10 + bell * 16) * ribbon.widthScale;
        upperX.push(x);
        upperY.push(y - halfW);
        lowerX.push(x);
        lowerY.push(y + halfW);
      }

      const alpha = ribbon.alpha * opacityMult;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(upperX[0], upperY[0]);
      for (let i = 1; i < RIBBON_SAMPLES - 1; i++) {
        const xc = (upperX[i] + upperX[i + 1]) * 0.5;
        const yc = (upperY[i] + upperY[i + 1]) * 0.5;
        ctx.quadraticCurveTo(upperX[i], upperY[i], xc, yc);
      }
      ctx.lineTo(upperX[RIBBON_SAMPLES - 1], upperY[RIBBON_SAMPLES - 1]);
      ctx.lineTo(lowerX[RIBBON_SAMPLES - 1], lowerY[RIBBON_SAMPLES - 1]);
      for (let i = RIBBON_SAMPLES - 2; i >= 1; i--) {
        const xc = (lowerX[i] + lowerX[i - 1]) * 0.5;
        const yc = (lowerY[i] + lowerY[i - 1]) * 0.5;
        ctx.quadraticCurveTo(lowerX[i], lowerY[i], xc, yc);
      }
      ctx.closePath();

      const [r, g, b] = ribbon.tint;
      const grad = ctx.createLinearGradient(0, h * 0.15, w, h * 0.85);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.06 * alpha})`);
      grad.addColorStop(0.28, `rgba(${r}, ${g}, ${b}, ${0.24 * alpha})`);
      grad.addColorStop(0.55, `rgba(224, 247, 255, ${0.36 * alpha})`);
      grad.addColorStop(0.78, `rgba(${r}, ${g}, ${b}, ${0.22 * alpha})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${0.05 * alpha})`);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(upperX[0], upperY[0]);
      for (let i = 1; i < RIBBON_SAMPLES - 1; i++) {
        const xc = (upperX[i] + upperX[i + 1]) * 0.5;
        const yc = (upperY[i] + upperY[i + 1]) * 0.5;
        ctx.quadraticCurveTo(upperX[i], upperY[i], xc, yc);
      }
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.78 * alpha})`;
      ctx.lineWidth = ribbon.isFront ? 1.35 : 0.85;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(lowerX[0], lowerY[0]);
      for (let i = 1; i < RIBBON_SAMPLES - 1; i++) {
        const xc = (lowerX[i] + lowerX[i + 1]) * 0.5;
        const yc = (lowerY[i] + lowerY[i + 1]) * 0.5;
        ctx.quadraticCurveTo(lowerX[i], lowerY[i], xc, yc);
      }
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.44 * alpha})`;
      ctx.lineWidth = ribbon.isFront ? 1.1 : 0.7;
      ctx.stroke();
      ctx.restore();
    };

    const drawOrbitalGyroRing = (
      cx: number,
      cy: number,
      radius: number,
      time: number,
      frontHalf: boolean
    ) => {
      const ringR = radius * 1.14;
      const tilt = -0.34;
      const squash = 0.27;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);

      ctx.beginPath();
      const startAngle = frontHalf ? 0 : Math.PI;
      const endAngle = frontHalf ? Math.PI : Math.PI * 2;
      ctx.ellipse(0, 0, ringR, ringR * squash, 0, startAngle, endAngle);
      ctx.strokeStyle = frontHalf
        ? "rgba(218, 244, 255, 0.52)"
        : "rgba(186, 230, 253, 0.24)";
      ctx.lineWidth = frontHalf ? 1.25 : 0.95;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let s = 0; s < 3; s++) {
        const angle = (time * 0.26 + s * ((Math.PI * 2) / 3)) % (Math.PI * 2);
        const isFrontSat = angle >= 0 && angle <= Math.PI;
        if (isFrontSat !== frontHalf) continue;
        const sx = Math.cos(angle) * ringR;
        const sy = Math.sin(angle) * ringR * squash;
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 9);
        glow.addColorStop(0, "#FFFFFF");
        glow.addColorStop(0.45, "rgba(56, 189, 248, 0.88)");
        glow.addColorStop(1, "rgba(56, 189, 248, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawCrystalGlobeFallback = (
      cx: number,
      cy: number,
      radius: number,
      rotY: number,
      rotX: number
    ) => {
      const haloGrad = ctx.createRadialGradient(
        cx - radius * 0.18,
        cy - radius * 0.22,
        radius * 0.52,
        cx,
        cy,
        radius * 1.28
      );
      haloGrad.addColorStop(0, "rgba(186, 232, 255, 0.72)");
      haloGrad.addColorStop(0.62, "rgba(110, 186, 236, 0.34)");
      haloGrad.addColorStop(1, "rgba(56, 132, 194, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.28, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      const sphereGrad = ctx.createRadialGradient(
        cx - radius * 0.34,
        cy - radius * 0.36,
        radius * 0.06,
        cx + radius * 0.12,
        cy + radius * 0.16,
        radius * 1.12
      );
      sphereGrad.addColorStop(0, "rgba(226, 245, 255, 0.95)");
      sphereGrad.addColorStop(0.28, "rgba(142, 202, 240, 0.88)");
      sphereGrad.addColorStop(0.64, "rgba(54, 126, 184, 0.88)");
      sphereGrad.addColorStop(0.92, "rgba(24, 72, 122, 0.92)");
      sphereGrad.addColorStop(1, "rgba(16, 48, 88, 0.95)");
      ctx.fillStyle = sphereGrad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      CONTINENT_POLYGONS.forEach((poly) => {
        const projected: ProjectedPoint[] = [];
        let frontCount = 0;
        for (const [lat, lng] of poly) {
          const r = rotatePoint(latLngToUnit(lat, lng), rotY, rotX);
          if (r.z > -0.05) frontCount++;
          projected.push({
            x: cx + r.x * radius,
            y: cy + r.y * radius,
            z: r.z,
          });
        }
        if (frontCount < 3) return;
        ctx.beginPath();
        let started = false;
        for (const pt of projected) {
          if (pt.z < -0.16) continue;
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
        if (started) {
          ctx.closePath();
          ctx.fillStyle = "rgba(210, 240, 255, 0.22)";
          ctx.fill();
          ctx.strokeStyle = "rgba(196, 238, 255, 0.56)";
          ctx.lineWidth = 1.05;
          ctx.stroke();
        }
      });

      ctx.fillStyle = "rgba(230, 248, 255, 0.65)";
      for (let i = 0; i < PRECOMPUTED_DOT_UNITS.length; i++) {
        const r = rotatePoint(PRECOMPUTED_DOT_UNITS[i], rotY, rotX);
        if (r.z <= 0.04) continue;
        const px = cx + r.x * radius;
        const py = cy + r.y * radius;
        ctx.globalAlpha = 0.25 + r.z * 0.55;
        ctx.beginPath();
        ctx.arc(px, py, 1.0 + r.z * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const fresnel = ctx.createRadialGradient(
        cx - radius * 0.36,
        cy - radius * 0.38,
        radius * 0.1,
        cx,
        cy,
        radius
      );
      fresnel.addColorStop(0, "rgba(255, 255, 255, 0.28)");
      fresnel.addColorStop(0.62, "rgba(125, 211, 252, 0)");
      fresnel.addColorStop(0.9, "rgba(147, 224, 255, 0.3)");
      fresnel.addColorStop(1, "rgba(224, 247, 255, 0.78)");
      ctx.fillStyle = fresnel;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(224, 246, 255, 0.88)";
      ctx.lineWidth = 1.65;
      ctx.stroke();
    };

    const drawCrystalOrb = (
      x: number,
      y: number,
      status: ClaimStatus | "ADJUDICATING",
      isSelected: boolean,
      isHovered: boolean,
      time: number,
      depthAlpha: number
    ) => {
      const style = BEACON_STYLES[status];
      const baseR = isSelected ? 9.6 : isHovered ? 8.4 : 7.0;
      const pulse = 1 + Math.sin(time * (status === "ADJUDICATING" ? 5.2 : 2.6)) * 0.22;

      ctx.save();
      ctx.globalAlpha = depthAlpha;

      const auraR = baseR * (isSelected ? 4.0 : 3.0) * pulse;
      const aura = ctx.createRadialGradient(x, y, baseR * 0.2, x, y, auraR);
      aura.addColorStop(0, style.glow);
      aura.addColorStop(0.55, "rgba(255, 255, 255, 0.22)");
      aura.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(x, y, auraR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, baseR * (isSelected ? 1.85 : 1.48), 0, Math.PI * 2);
      ctx.strokeStyle = style.ring;
      ctx.lineWidth = isSelected ? 1.6 : 1.1;
      ctx.stroke();

      const bodyGrad = ctx.createRadialGradient(
        x - baseR * 0.35,
        y - baseR * 0.38,
        baseR * 0.1,
        x,
        y,
        baseR
      );
      bodyGrad.addColorStop(0, "#FFFFFF");
      bodyGrad.addColorStop(0.45, style.core);
      bodyGrad.addColorStop(1, style.mid);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(x, y, baseR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.96)";
      ctx.lineWidth = 1.3;
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
      ctx.beginPath();
      ctx.arc(x - baseR * 0.32, y - baseR * 0.34, baseR * 0.27, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawValidatorCrystal = (
      x: number,
      y: number,
      label: string,
      isSelected: boolean,
      isHovered: boolean,
      isConverging: boolean,
      time: number,
      depthAlpha: number
    ) => {
      const size = isSelected || isHovered ? 7.8 : 5.6;
      const pulse = 1 + Math.sin(time * (isConverging ? 6 : 2.4)) * 0.18;

      ctx.save();
      ctx.globalAlpha = depthAlpha;

      const aura = ctx.createRadialGradient(x, y, 0, x, y, size * 3.4 * pulse);
      aura.addColorStop(
        0,
        isConverging
          ? "rgba(52, 211, 153, 0.82)"
          : isSelected
            ? "rgba(56, 189, 248, 0.88)"
            : "rgba(125, 211, 252, 0.6)"
      );
      aura.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(x, y, size * 3.4 * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.88, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.88, 0);
      ctx.closePath();
      ctx.fillStyle = isConverging
        ? "#6EE7B7"
        : isSelected
          ? "#E0F2FE"
          : "rgba(186, 230, 253, 0.95)";
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = isSelected ? 1.6 : 1.1;
      ctx.stroke();

      // Subtle translucent dark-sapphire tag pill so V1-V5 stay crisp over bright clouds
      drawRoundedPill(ctx, -13, size + 3, 26, 13, 6.5);
      ctx.fillStyle = "rgba(12, 34, 62, 0.62)";
      ctx.fill();

      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.fillStyle = "#E0F2FE";
      ctx.textAlign = "center";
      ctx.fillText(label, 0, size + 12.2);
      ctx.restore();
    };

    const drawConvergingArcs = (
      targetUnit: Vec3,
      activeStageCount: number,
      cx: number,
      cy: number,
      radius: number,
      rotY: number,
      rotX: number,
      time: number
    ) => {
      VALIDATOR_HUBS.forEach((_, idx) => {
        const hubUnit = PRECOMPUTED_HUB_UNITS[idx];
        const active = idx < Math.max(1, activeStageCount);
        const steps = 32;
        const pts: ProjectedPoint[] = [];

        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const p = slerpUnit(hubUnit, targetUnit, u);
          const elev = 1 + Math.sin(u * Math.PI) * 0.26;
          const rot = rotatePoint(
            { x: p.x * elev, y: p.y * elev, z: p.z * elev },
            rotY,
            rotX
          );
          pts.push({
            x: cx + rot.x * radius,
            y: cy + rot.y * radius,
            z: rot.z,
          });
        }

        ctx.save();
        ctx.beginPath();
        pts.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.strokeStyle = active
          ? "rgba(52, 211, 153, 0.85)"
          : "rgba(125, 211, 252, 0.42)";
        ctx.lineWidth = active ? 2.3 : 1.25;
        ctx.stroke();

        const progress = (time * 0.72 + idx * 0.19) % 1;
        const pulseIdx = Math.min(steps, Math.floor(progress * steps));
        const pulsePt = pts[pulseIdx];
        if (pulsePt.z > -0.25) {
          const gPulse = ctx.createRadialGradient(
            pulsePt.x,
            pulsePt.y,
            0,
            pulsePt.x,
            pulsePt.y,
            12
          );
          gPulse.addColorStop(0, "#FFFFFF");
          gPulse.addColorStop(
            0.45,
            active ? "rgba(52, 211, 153, 0.96)" : "rgba(56, 189, 248, 0.92)"
          );
          gPulse.addColorStop(1, "rgba(255, 255, 255, 0)");
          ctx.fillStyle = gPulse;
          ctx.beginPath();
          ctx.arc(pulsePt.x, pulsePt.y, 12, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    };

    const tick = (nowMs: number) => {
      const time = nowMs * 0.001;
      const st = stateRef.current;
      const currentProps = propsRef.current;
      const { width: w, height: h, dpr } = st;

      const targetCenterRatio = currentProps.pureOrbit ? 0.5 : 0.41;
      st.centerXRatio += (targetCenterRatio - st.centerXRatio) * 0.065;
      st.zoom += (st.targetZoom - st.zoom) * 0.09;

      if (!st.dragging) {
        if (st.targetRotY !== null && st.targetRotX !== null) {
          const dy = st.targetRotY - st.rotY;
          const dx = st.targetRotX - st.rotX;
          st.rotY += dy * 0.075;
          st.rotX += dx * 0.075;
          if (Math.abs(dy) < 0.0015 && Math.abs(dx) < 0.0015) {
            st.targetRotY = null;
            st.targetRotX = null;
          }
        } else {
          const spinSpeed = currentProps.autoSpin ? 0.00145 : 0;
          st.rotY += st.velY + spinSpeed;
          st.rotX = Math.max(-0.92, Math.min(0.92, st.rotX + st.velX));
          st.velY *= 0.935;
          st.velX *= 0.92;
        }
      }

      const pointerSpeed = Math.hypot(st.mouseVx, st.mouseVy);
      st.ribbons.forEach((ribbon) => {
        const nextVy = new Float32Array(RIBBON_SAMPLES);
        for (let i = 0; i < RIBBON_SAMPLES; i++) {
          const t = i / (RIBBON_SAMPLES - 1);
          const rx = (-0.1 + t * 1.2) * w;
          const ry = computeRibbonBaseY(t, h, time, ribbon) + ribbon.dy[i];

          let force = -ribbon.dy[i] * 0.042;
          if (i > 0 && i < RIBBON_SAMPLES - 1) {
            force +=
              (ribbon.dy[i - 1] + ribbon.dy[i + 1] - 2 * ribbon.dy[i]) * 0.14;
          }

          const dx = rx - st.mouseX;
          const dy = ry - st.mouseY;
          const dist = Math.hypot(dx, dy);
          if (dist < 210) {
            const falloff = (1 - dist / 210) ** 2;
            const repelDir = dy >= 0 ? 1 : -1;
            const velocityPush = Math.max(-22, Math.min(22, st.mouseVy * 0.22));
            force += (repelDir * 2.1 + velocityPush) * falloff;
            if (pointerSpeed > 8 && ribbon.isFront) {
              crystalAudio.playRibbonBrush(pointerSpeed);
            }
          }

          nextVy[i] = (ribbon.vy[i] + force) * 0.875;
        }
        for (let i = 0; i < RIBBON_SAMPLES; i++) {
          ribbon.vy[i] = nextVy[i];
          ribbon.dy[i] = Math.max(-95, Math.min(95, ribbon.dy[i] + ribbon.vy[i]));
        }
      });

      st.mouseVx *= 0.72;
      st.mouseVy *= 0.72;

      ctx.clearRect(0, 0, w, h);

      const cx = w * st.centerXRatio;
      const cy = h * 0.54;
      const radius = Math.min(w * 0.37, h * 0.48) * st.zoom;
      const isRealEarth =
        currentProps.globeTheme !== "crystal" && earthRenderer.supported;

      // 1. Rear silk ribbons & rear half of orbital gyro ring
      st.ribbons
        .filter((r) => !r.isFront)
        .forEach((ribbon) => drawRibbon(ribbon, w, h, time, 1));
      drawOrbitalGyroRing(cx, cy, radius, time, false);

      // 2. Render Photorealistic WebGL Earth (or Sapphire Crystal fallback)
      if (isRealEarth) {
        const pad = earthRenderer.padRatio;
        const drawSpan = radius * 2 * pad;
        const glCanvas = earthRenderer.render(
          st.rotY,
          st.rotX,
          time,
          drawSpan * dpr,
          {
            theme: currentProps.globeTheme,
            showClouds: currentProps.showClouds,
          }
        );
        if (glCanvas) {
          ctx.drawImage(
            glCanvas,
            cx - radius * pad,
            cy - radius * pad,
            drawSpan,
            drawSpan
          );
        }
      } else {
        drawCrystalGlobeFallback(cx, cy, radius, st.rotY, st.rotX);
      }

      // 3. Subtle optical latitude/longitude graticule + ambient validator mesh over sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      const gridAlpha = isRealEarth ? 0.1 : 0.17;
      ctx.lineWidth = 0.7;
      for (let lat = -60; lat <= 60; lat += 20) {
        ctx.beginPath();
        let drawing = false;
        for (let lng = -180; lng <= 180; lng += 6) {
          const r = rotatePoint(latLngToUnit(lat, lng), st.rotY, st.rotX);
          if (r.z > 0.02) {
            const px = cx + r.x * radius;
            const py = cy + r.y * radius;
            if (!drawing) {
              ctx.moveTo(px, py);
              drawing = true;
            } else {
              ctx.lineTo(px, py);
            }
          } else {
            drawing = false;
          }
        }
        ctx.strokeStyle =
          lat === 0
            ? `rgba(186, 235, 255, ${gridAlpha * 1.9})`
            : `rgba(186, 230, 253, ${gridAlpha})`;
        ctx.stroke();
      }
      for (let lng = -180; lng < 180; lng += 20) {
        ctx.beginPath();
        let drawing = false;
        for (let lat = -84; lat <= 84; lat += 6) {
          const r = rotatePoint(latLngToUnit(lat, lng), st.rotY, st.rotX);
          if (r.z > 0.02) {
            const px = cx + r.x * radius;
            const py = cy + r.y * radius;
            if (!drawing) {
              ctx.moveTo(px, py);
              drawing = true;
            } else {
              ctx.lineTo(px, py);
            }
          } else {
            drawing = false;
          }
        }
        ctx.strokeStyle = `rgba(186, 230, 253, ${gridAlpha})`;
        ctx.stroke();
      }

      VALIDATOR_MESH_PAIRS.forEach(([idxA, idxB], pairIdx) => {
        const a = PRECOMPUTED_HUB_UNITS[idxA];
        const b = PRECOMPUTED_HUB_UNITS[idxB];
        const steps = 22;
        const pts: ProjectedPoint[] = [];
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const p = slerpUnit(a, b, u);
          const elev = 1 + Math.sin(u * Math.PI) * 0.1;
          const rot = rotatePoint(
            { x: p.x * elev, y: p.y * elev, z: p.z * elev },
            st.rotY,
            st.rotX
          );
          pts.push({
            x: cx + rot.x * radius,
            y: cy + rot.y * radius,
            z: rot.z,
          });
        }

        ctx.beginPath();
        let started = false;
        for (const pt of pts) {
          if (pt.z < 0.02) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
        ctx.strokeStyle = "rgba(165, 232, 255, 0.28)";
        ctx.lineWidth = 1;
        ctx.stroke();

        const progress = (time * 0.24 + pairIdx * 0.17) % 1;
        const motePt = pts[Math.min(steps, Math.floor(progress * steps))];
        if (motePt.z > 0.08) {
          ctx.fillStyle = "rgba(224, 248, 255, 0.92)";
          ctx.beginPath();
          ctx.arc(motePt.x, motePt.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.restore();

      // 4. Foreground orbital gyro ring + 5 liquid-glass silk ribbons (refined clarity over Real Earth)
      drawOrbitalGyroRing(cx, cy, radius, time, true);
      const frontRibbonOpacity = isRealEarth ? 0.72 : 1.0;
      st.ribbons
        .filter((r) => r.isFront)
        .forEach((ribbon) => drawRibbon(ribbon, w, h, time, frontRibbonOpacity));

      // 5. Transient interactive diagnostic pulse arcs
      st.pulseArcs = st.pulseArcs.filter((arc) => {
        const age = time - arc.bornAt;
        if (age > arc.duration) return false;
        if (age < 0) return true;
        const progress = age / arc.duration;
        const steps = 28;
        ctx.save();
        ctx.beginPath();
        let lastPt: ProjectedPoint | null = null;
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          if (u > progress) break;
          const p = slerpUnit(arc.from, arc.to, u);
          const elev = 1 + Math.sin(u * Math.PI) * 0.22;
          const rot = rotatePoint(
            { x: p.x * elev, y: p.y * elev, z: p.z * elev },
            st.rotY,
            st.rotX
          );
          const pt = { x: cx + rot.x * radius, y: cy + rot.y * radius, z: rot.z };
          if (s === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
          lastPt = pt;
        }
        ctx.strokeStyle = arc.color;
        ctx.globalAlpha = Math.max(0, 1 - progress * 0.85);
        ctx.lineWidth = 2.1;
        ctx.stroke();
        if (lastPt && lastPt.z > -0.2) {
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(lastPt.x, lastPt.y, 3.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return true;
      });

      // 6. Five Optimistic Democracy validator beams (Real Adjudication OR Demo Flow)
      if (currentProps.adjudicatingClaimId) {
        const target = currentProps.claims.find(
          (c) => c.claim_id === currentProps.adjudicatingClaimId
        );
        if (target) {
          const targetUnit = latLngToUnit(
            target.lat_e4 / 10000,
            target.lng_e4 / 10000
          );
          drawConvergingArcs(
            targetUnit,
            currentProps.adjudicationStage,
            cx,
            cy,
            radius,
            st.rotY,
            st.rotX,
            time
          );
        }
      } else if (currentProps.demoVisual?.active) {
        const demoUnit = latLngToUnit(
          currentProps.demoVisual.lat,
          currentProps.demoVisual.lng
        );
        const demoRot = rotatePoint(demoUnit, st.rotY, st.rotX);
        const dx = cx + demoRot.x * radius;
        const dy = cy + demoRot.y * radius;

        if (currentProps.demoVisual.step === 1 && demoRot.z > -0.1) {
          ctx.save();
          for (let b = -1; b <= 1; b += 2) {
            const beamTopX = dx + b * 42;
            const beamTopY = dy - 135;
            const g = ctx.createLinearGradient(dx, dy, beamTopX, beamTopY);
            g.addColorStop(0, "rgba(56, 189, 248, 0.95)");
            g.addColorStop(1, "rgba(186, 230, 253, 0)");
            ctx.strokeStyle = g;
            ctx.lineWidth = 2.3;
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(beamTopX, beamTopY);
            ctx.stroke();

            const up = (time * 1.1 + (b > 0 ? 0.5 : 0)) % 1;
            const px = dx + (beamTopX - dx) * up;
            const py = dy + (beamTopY - dy) * up;
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(px, py, 3.4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        if (currentProps.demoVisual.step === 2) {
          drawConvergingArcs(
            demoUnit,
            5,
            cx,
            cy,
            radius,
            st.rotY,
            st.rotX,
            time
          );
        }

        if (demoRot.z > -0.1) {
          const demoStatus: ClaimStatus | "ADJUDICATING" =
            currentProps.demoVisual.step === 3
              ? "VERIFIED"
              : currentProps.demoVisual.step >= 1
                ? "ADJUDICATING"
                : "ACTIVE";
          drawCrystalOrb(dx, dy, demoStatus, true, false, time, 1);

          const ringR = 16 + ((time * 24) % 28);
          ctx.save();
          ctx.beginPath();
          ctx.arc(dx, dy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle =
            demoStatus === "VERIFIED"
              ? "rgba(52, 211, 153, 0.8)"
              : "rgba(125, 211, 252, 0.85)";
          ctx.globalAlpha = Math.max(0, 1 - (ringR - 16) / 28);
          ctx.lineWidth = 1.7;
          ctx.stroke();
          ctx.restore();

          // Crisp frosted-dark tag pill for demo beacon
          ctx.save();
          ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
          const textW = ctx.measureText(currentProps.demoVisual.label).width;
          drawRoundedPill(ctx, dx - textW / 2 - 10, dy - 38, textW + 20, 20, 10);
          ctx.fillStyle = "rgba(10, 30, 56, 0.74)";
          ctx.fill();
          ctx.strokeStyle = "rgba(186, 230, 253, 0.55)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "#FFFFFF";
          ctx.textAlign = "center";
          ctx.fillText(currentProps.demoVisual.label, dx, dy - 24.5);
          ctx.restore();
        }
      }

      // 7. Interactive 5 Global Validator Hub Diamond Crystals
      const isConvergingNow =
        Boolean(currentProps.adjudicatingClaimId) ||
        (Boolean(currentProps.demoVisual?.active) &&
          currentProps.demoVisual?.step === 2);

      const nextValidators: ScreenValidator[] = VALIDATOR_HUBS.map((hub, idx) => {
        const r = rotatePoint(PRECOMPUTED_HUB_UNITS[idx], st.rotY, st.rotX);
        return {
          id: hub.id,
          city: hub.city,
          lat: hub.lat,
          lng: hub.lng,
          x: cx + r.x * radius,
          y: cy + r.y * radius,
          z: r.z,
        };
      });
      st.screenValidators = nextValidators;

      nextValidators.forEach((v) => {
        if (v.z < -0.04) return;
        const alpha = Math.max(0.25, Math.min(1, (v.z + 0.04) / 0.35));
        drawValidatorCrystal(
          v.x,
          v.y,
          v.id,
          currentProps.selectedValidatorId === v.id,
          st.hoveredValidatorId === v.id,
          isConvergingNow,
          time,
          alpha
        );
      });

      // 8. Project, depth-sort, and render crystal claim beacons with crisp pill tags
      const nextBeacons: ScreenBeacon[] = currentProps.claims
        .map((claim) => {
          const r = rotatePoint(
            latLngToUnit(claim.lat_e4 / 10000, claim.lng_e4 / 10000),
            st.rotY,
            st.rotX
          );
          return {
            claim,
            x: cx + r.x * radius,
            y: cy + r.y * radius,
            z: r.z,
          };
        })
        .sort((a, b) => a.z - b.z);

      st.screenBeacons = nextBeacons;

      nextBeacons.forEach(({ claim, x, y, z }) => {
        if (z < -0.1) return;
        const depthAlpha = Math.max(0.24, Math.min(1, (z + 0.1) / 0.4));
        const isAdjudicating = currentProps.adjudicatingClaimId === claim.claim_id;
        const isSelected = currentProps.selectedClaimId === claim.claim_id;
        const isHovered = st.hoveredClaimId === claim.claim_id;
        const visualStatus = isAdjudicating ? "ADJUDICATING" : claim.status;

        drawCrystalOrb(x, y, visualStatus, isSelected, isHovered, time, depthAlpha);

        if (z > 0.06) {
          const style = BEACON_STYLES[visualStatus];
          ctx.save();
          ctx.globalAlpha = depthAlpha * (isSelected || isHovered ? 1 : 0.94);

          ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
          const w1 = ctx.measureText(claim.claim_id).width;
          ctx.font = '700 8.5px "JetBrains Mono", monospace';
          const w2 = ctx.measureText(visualStatus).width;
          const pillW = Math.max(w1, w2) + 16;

          drawRoundedPill(ctx, x - pillW / 2, y - 40, pillW, 27, 9);
          ctx.fillStyle = isSelected
            ? "rgba(10, 32, 60, 0.80)"
            : "rgba(12, 36, 66, 0.62)";
          ctx.fill();
          ctx.strokeStyle = isSelected
            ? style.ring
            : "rgba(255, 255, 255, 0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = "#FFFFFF";
          ctx.textAlign = "center";
          ctx.fillText(claim.claim_id, x, y - 27.5);

          ctx.font = '700 8.5px "JetBrains Mono", monospace';
          ctx.fillStyle = style.badgeText;
          ctx.fillText(visualStatus, x, y - 17.5);
          ctx.restore();
        }
      });

      // 9. Temporary pin marker
      if (currentProps.pinnedCoords) {
        const r = rotatePoint(
          latLngToUnit(currentProps.pinnedCoords.lat, currentProps.pinnedCoords.lng),
          st.rotY,
          st.rotX
        );
        if (r.z > -0.05) {
          const px = cx + r.x * radius;
          const py = cy + r.y * radius;
          const pulseR = 12 + Math.sin(time * 4.5) * 4;
          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, pulseR, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(56, 189, 248, 0.94)";
          ctx.lineWidth = 1.8;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(px, py, 5.5, 0, Math.PI * 2);
          ctx.fillStyle = "#0284C7";
          ctx.fill();
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.restore();
        }
      }

      // 10. Expanding optical ripples & finality shockwaves
      st.ripples = st.ripples.filter((rp) => {
        rp.radius += (rp.maxRadius - rp.radius) * 0.055 + 1.8;
        rp.alpha *= 0.945;
        if (rp.alpha < 0.015) return false;

        ctx.save();
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
        ctx.strokeStyle = rp.color;
        ctx.globalAlpha = rp.alpha;
        ctx.lineWidth = rp.lineWidth;
        ctx.stroke();
        ctx.restore();
        return true;
      });

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      earthRenderer.dispose();
      earthRendererRef.current = null;
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    st.dragging = true;
    st.lastPointerX = e.clientX;
    st.lastPointerY = e.clientY;
    st.dragDistance = 0;
    st.targetRotY = null;
    st.targetRotX = null;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    const dx = e.clientX - st.lastPointerX;
    const dy = e.clientY - st.lastPointerY;

    st.mouseVx = dx;
    st.mouseVy = dy;
    st.mouseX = e.clientX;
    st.mouseY = e.clientY;

    document.documentElement.style.setProperty("--sky-x", `${e.clientX}px`);
    document.documentElement.style.setProperty("--sky-y", `${e.clientY}px`);

    const cx = st.width * st.centerXRatio;
    const cy = st.height * 0.54;
    const radius = Math.min(st.width * 0.37, st.height * 0.48) * st.zoom;

    if (st.dragging) {
      st.dragDistance += Math.hypot(dx, dy);
      st.rotY += dx * 0.0052;
      st.rotX = Math.max(-0.92, Math.min(0.92, st.rotX - dy * 0.0046));
      st.velY = dx * 0.0022;
      st.velX = -dy * 0.0018;
      if (st.hoveredClaimId) {
        st.hoveredClaimId = null;
        propsRef.current.onHoverBeacon(null);
      }
    } else {
      const now = performance.now();
      if (now - st.lastCoordEmitMs > 65) {
        st.lastCoordEmitMs = now;
        const coords = screenToLatLng(
          e.clientX,
          e.clientY,
          cx,
          cy,
          radius,
          st.rotY,
          st.rotX
        );
        propsRef.current.onCursorCoords(coords);
      }

      let hitBeacon: ScreenBeacon | null = null;
      for (let i = st.screenBeacons.length - 1; i >= 0; i--) {
        const b = st.screenBeacons[i];
        if (b.z < 0.04) continue;
        if (Math.hypot(e.clientX - b.x, e.clientY - b.y) <= 22) {
          hitBeacon = b;
          break;
        }
      }

      if (hitBeacon) {
        if (hitBeacon.claim.claim_id !== st.hoveredClaimId) {
          crystalAudio.playBeaconHover();
          st.hoveredClaimId = hitBeacon.claim.claim_id;
        }
        propsRef.current.onHoverBeacon({
          claim: hitBeacon.claim,
          x: hitBeacon.x,
          y: hitBeacon.y,
        });
      } else if (st.hoveredClaimId !== null) {
        st.hoveredClaimId = null;
        propsRef.current.onHoverBeacon(null);
      }

      let hitValId: string | null = null;
      if (!hitBeacon) {
        for (const v of st.screenValidators) {
          if (v.z < 0.04) continue;
          if (Math.hypot(e.clientX - v.x, e.clientY - v.y) <= 18) {
            hitValId = v.id;
            break;
          }
        }
      }
      if (hitValId && hitValId !== st.hoveredValidatorId) {
        crystalAudio.playBeaconHover();
      }
      st.hoveredValidatorId = hitValId;
    }

    st.lastPointerX = e.clientX;
    st.lastPointerY = e.clientY;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    st.dragging = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (st.dragDistance >= 6) return;

    const currentProps = propsRef.current;
    const cx = st.width * st.centerXRatio;
    const cy = st.height * 0.54;
    const radius = Math.min(st.width * 0.37, st.height * 0.48) * st.zoom;

    if (currentProps.pinMode) {
      const coords = screenToLatLng(
        e.clientX,
        e.clientY,
        cx,
        cy,
        radius,
        st.rotY,
        st.rotX
      );
      if (coords) {
        crystalAudio.playBeaconSelect();
        st.ripples.push({
          x: e.clientX,
          y: e.clientY,
          radius: 6,
          maxRadius: 115,
          alpha: 0.78,
          color: "#38BDF8",
          lineWidth: 1.9,
        });
        currentProps.onPinCoords(coords);
      }
      return;
    }

    for (let i = st.screenBeacons.length - 1; i >= 0; i--) {
      const b = st.screenBeacons[i];
      if (b.z < 0.04) continue;
      if (Math.hypot(e.clientX - b.x, e.clientY - b.y) <= 24) {
        crystalAudio.playBeaconSelect();
        currentProps.onSelectValidator(null);
        currentProps.onSelectClaim(b.claim.claim_id);
        return;
      }
    }

    for (const v of st.screenValidators) {
      if (v.z < 0.04) continue;
      if (Math.hypot(e.clientX - v.x, e.clientY - v.y) <= 20) {
        crystalAudio.playBeaconSelect();
        currentProps.onSelectValidator(v.id);
        st.ripples.push({
          x: v.x,
          y: v.y,
          radius: 8,
          maxRadius: 120,
          alpha: 0.8,
          color: "#34D399",
          lineWidth: 1.8,
        });
        return;
      }
    }

    currentProps.onSelectValidator(null);
    crystalAudio.playRipple();
    st.ripples.push({
      x: e.clientX,
      y: e.clientY,
      radius: 8,
      maxRadius: 165,
      alpha: 0.62,
      color: "rgba(186, 230, 253, 0.95)",
      lineWidth: 1.6,
    });
    exciteRibbonsNear(e.clientX, 6.5);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    const cx = st.width * st.centerXRatio;
    const cy = st.height * 0.54;
    const radius = Math.min(st.width * 0.37, st.height * 0.48) * st.zoom;
    const coords = screenToLatLng(
      e.clientX,
      e.clientY,
      cx,
      cy,
      radius,
      st.rotY,
      st.rotX
    );
    if (!coords) return;

    crystalAudio.playValidatorPulse(2);
    st.ripples.push(
      {
        x: e.clientX,
        y: e.clientY,
        radius: 10,
        maxRadius: 240,
        alpha: 0.88,
        color: "#38BDF8",
        lineWidth: 2.3,
      },
      {
        x: e.clientX,
        y: e.clientY,
        radius: 4,
        maxRadius: 150,
        alpha: 0.8,
        color: "#FFFFFF",
        lineWidth: 1.5,
      }
    );
    exciteRibbonsNear(e.clientX, 11.5);

    const clickUnit = latLngToUnit(coords.lat, coords.lng);
    let nearestIdx = 0;
    let bestDot = -2;
    PRECOMPUTED_HUB_UNITS.forEach((hubU, idx) => {
      const d = hubU.x * clickUnit.x + hubU.y * clickUnit.y + hubU.z * clickUnit.z;
      if (d > bestDot) {
        bestDot = d;
        nearestIdx = idx;
      }
    });

    const now = performance.now() * 0.001;
    st.pulseArcs.push({
      from: clickUnit,
      to: PRECOMPUTED_HUB_UNITS[nearestIdx],
      bornAt: now,
      duration: 1.35,
      color: "#6EE7B7",
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    st.targetZoom = Math.max(
      0.82,
      Math.min(1.24, st.targetZoom - e.deltaY * 0.00045)
    );
  };

  const cursorClass = props.pinMode
    ? "cursor-crosshair"
    : "cursor-grab active:cursor-grabbing";

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onPointerLeave={() => {
        stateRef.current.mouseX = -9999;
        stateRef.current.mouseY = -9999;
        propsRef.current.onCursorCoords(null);
        propsRef.current.onHoverBeacon(null);
      }}
      onWheel={handleWheel}
      className={`fixed inset-0 z-10 h-full w-full touch-none select-none ${cursorClass}`}
    />
  );
};
