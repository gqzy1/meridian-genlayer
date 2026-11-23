import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  Globe2,
  Languages,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from "lucide-react";
import {
  MERIDIAN_DEPLOYED,
  VALIDATOR_HUBS,
  formatShortAddress,
  type ClaimStatus,
} from "./config/meridian";
import { MESSAGES, type Locale } from "./i18n/messages";
import { crystalAudio } from "./utils/crystalAudio";
import {
  MeridianGlobe,
  type DemoVisualState,
  type GlobeCommand,
  type GlobeTheme,
  type HoveredBeaconInfo,
  type ShockwaveSignal,
} from "./components/globe/MeridianGlobe";
import { DossierCard } from "./components/hud/DossierCard";
import { DemoFlowBar } from "./components/hud/DemoFlowBar";
import { SubmitClaimModal, WalletModal } from "./components/hud/Modals";
import { useMultiWallet } from "./hooks/useMultiWallet";
import {
  useMeridianChain,
  type SubmitClaimPayload,
} from "./hooks/useMeridianChain";

type FilterValue = "ALL" | ClaimStatus;

const THEME_ORDER: GlobeTheme[] = ["earth", "twilight", "crystal"];

export function App() {
  const [locale, setLocale] = useState<Locale>("en");
  const [filter, setFilter] = useState<FilterValue>("ALL");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [selectedValidatorId, setSelectedValidatorId] = useState<string | null>(null);
  const [hoveredBeacon, setHoveredBeacon] = useState<HoveredBeaconInfo | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const [globeTheme, setGlobeTheme] = useState<GlobeTheme>("earth");
  const [showClouds, setShowClouds] = useState(true);
  const [pureOrbit, setPureOrbit] = useState(false);
  const [autoSpin, setAutoSpin] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Interactive 4-Step Demo Flow state
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(true);
  const [demoShockwave, setDemoShockwave] = useState<ShockwaveSignal | null>(null);

  const [globeCommand, setGlobeCommand] = useState<GlobeCommand | null>(null);
  const cmdSeqRef = useRef(1);
  const demoShockSeqRef = useRef(1000);

  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pinnedCoords, setPinnedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const t = MESSAGES[locale];

  const wallet = useMultiWallet();
  const chain = useMeridianChain({
    account: wallet.account,
    provider: wallet.provider,
    ensureStudioNet: wallet.ensureStudioNet,
  });

  const issueGlobeCommand = useCallback(
    (type: GlobeCommand["type"], lat?: number, lng?: number) => {
      cmdSeqRef.current += 1;
      setGlobeCommand({ type, lat, lng, seq: cmdSeqRef.current });
    },
    []
  );

  // Demo auto-advance timer
  useEffect(() => {
    if (!demoOpen || !demoPlaying) return;
    const timer = window.setInterval(() => {
      setDemoStep((prev) => (prev + 1) % 4);
    }, 4600);
    return () => window.clearInterval(timer);
  }, [demoOpen, demoPlaying]);

  // Trigger audio + finality shockwave when Demo Flow hits Step 4
  useEffect(() => {
    if (!demoOpen) return;
    if (demoStep === 2) {
      crystalAudio.playValidatorPulse(2);
    } else if (demoStep === 3) {
      demoShockSeqRef.current += 1;
      setDemoShockwave({
        claimId: "DEMO-01",
        status: "VERIFIED",
        seq: demoShockSeqRef.current,
      });
    }
  }, [demoOpen, demoStep]);

  const demoVisual: DemoVisualState | null = useMemo(() => {
    if (!demoOpen) return null;
    return {
      active: true,
      step: demoStep,
      lat: 35.6762,
      lng: 139.6503,
      label:
        demoStep === 3
          ? "DEMO · ILLUSTRATED VERDICT"
          : demoStep === 2
            ? "DEMO · CONSENSUS ILLUSTRATION"
            : demoStep === 1
              ? "DEMO · EVIDENCE ILLUSTRATION"
              : "DEMO · ANCHORED CLAIM",
    };
  }, [demoOpen, demoStep]);

  const filteredClaims = useMemo(() => {
    if (filter === "ALL") return chain.claims;
    return chain.claims.filter((c) => c.status === filter);
  }, [chain.claims, filter]);

  useEffect(() => {
    if (filteredClaims.length === 0) {
      setSelectedClaimId(null);
      return;
    }
    const stillVisible = filteredClaims.some(
      (c) => c.claim_id === selectedClaimId
    );
    if (!stillVisible) {
      setSelectedClaimId(filteredClaims[0].claim_id);
    }
  }, [filteredClaims, selectedClaimId]);

  const selectedClaim = useMemo(
    () =>
      filteredClaims.find((c) => c.claim_id === selectedClaimId) ??
      filteredClaims[0] ??
      null,
    [filteredClaims, selectedClaimId]
  );

  const selectedValidator = useMemo(
    () => VALIDATOR_HUBS.find((v) => v.id === selectedValidatorId) ?? null,
    [selectedValidatorId]
  );

  const stepCruise = useCallback(
    (delta: number) => {
      if (filteredClaims.length === 0) return;
      const currentIdx = filteredClaims.findIndex(
        (c) => c.claim_id === selectedClaimId
      );
      const base = currentIdx === -1 ? 0 : currentIdx;
      const nextIdx =
        (base + delta + filteredClaims.length) % filteredClaims.length;
      crystalAudio.playBeaconSelect();
      setDemoOpen(false);
      setSelectedValidatorId(null);
      setSelectedClaimId(filteredClaims[nextIdx].claim_id);
      if (pureOrbit) setPureOrbit(false);
    },
    [filteredClaims, selectedClaimId, pureOrbit]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (submitModalOpen || walletModalOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") stepCruise(1);
      if (e.key === "ArrowLeft") stepCruise(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepCruise, submitModalOpen, walletModalOpen]);

  const handleGlassMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }, []);

  const toggleSound = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    crystalAudio.setEnabled(next);
  };

  const cycleTheme = () => {
    const next =
      THEME_ORDER[(THEME_ORDER.indexOf(globeTheme) + 1) % THEME_ORDER.length];
    setGlobeTheme(next);
    crystalAudio.playBeaconHover();
  };

  const themeLabel =
    globeTheme === "earth"
      ? t.globeThemeEarth
      : globeTheme === "twilight"
        ? t.globeThemeTwilight
        : t.globeThemeCrystal;

  const toggleDemo = () => {
    if (demoOpen) {
      setDemoOpen(false);
    } else {
      setSelectedValidatorId(null);
      setDemoStep(0);
      setDemoPlaying(true);
      setDemoOpen(true);
      crystalAudio.playBeaconSelect();
    }
  };

  const handleSelectBeacon = (claimId: string) => {
    setDemoOpen(false);
    setSelectedClaimId(claimId);
    if (pureOrbit) setPureOrbit(false);
  };

  const handleSelectValidator = (validatorId: string | null) => {
    setSelectedValidatorId(validatorId);
    if (validatorId) {
      const hub = VALIDATOR_HUBS.find((h) => h.id === validatorId);
      if (hub) {
        issueGlobeCommand("FOCUS_COORDS", hub.lat, hub.lng);
      }
    }
  };

  const handlePinCoords = (coords: { lat: number; lng: number }) => {
    setPinnedCoords(coords);
    setPinMode(false);
    setSubmitModalOpen(true);
  };

  const handleSubmitClaim = async (payload: SubmitClaimPayload) => {
    const createdId = await chain.submitClaim(payload);
    if (createdId) {
      setSubmitModalOpen(false);
      setPinnedCoords(null);
      setFilter("ALL");
      setSelectedClaimId(createdId);
      setPureOrbit(false);
    }
  };

  const filterItems: Array<{ value: FilterValue; label: string; count: number }> = [
    { value: "ALL", label: t.filterAll, count: chain.stats.total_claims },
    { value: "ACTIVE", label: t.filterActive, count: chain.stats.active },
    { value: "VERIFIED", label: t.filterVerified, count: chain.stats.verified },
    { value: "REFUTED", label: t.filterRefuted, count: chain.stats.refuted },
    {
      value: "INCONCLUSIVE",
      label: t.filterInconclusive,
      count: chain.stats.inconclusive,
    },
  ];

  const activeShockwave = demoOpen ? demoShockwave : chain.shockwaveSignal;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* L0 Eye-Comfortable Atmospheric Glacial Sky Light Field */}
      <div className="meridian-atmosphere pointer-events-none fixed inset-0 z-0" />

      {/* L1 + L2 Living 60fps Photorealistic 3D Earth, Silk Ribbons, Hubs & Beacons */}
      <MeridianGlobe
        claims={filteredClaims}
        selectedClaimId={selectedClaim?.claim_id ?? null}
        selectedValidatorId={selectedValidatorId}
        adjudicatingClaimId={chain.adjudicatingClaimId}
        adjudicationStage={
          demoOpen && demoStep === 2 ? 5 : chain.adjudicationStage
        }
        shockwaveSignal={activeShockwave}
        globeCommand={globeCommand}
        demoVisual={demoVisual}
        globeTheme={globeTheme}
        showClouds={showClouds}
        autoSpin={autoSpin && !demoOpen}
        pureOrbit={pureOrbit}
        pinMode={pinMode}
        pinnedCoords={pinnedCoords}
        onSelectClaim={handleSelectBeacon}
        onSelectValidator={handleSelectValidator}
        onHoverBeacon={setHoveredBeacon}
        onCursorCoords={setCursorCoords}
        onPinCoords={handlePinCoords}
      />

      {/* L3 Full-Width Ultra-Thin VisionOS Floating Top Bar */}
      <header
        onPointerMove={handleGlassMove}
        className="meridian-glass fixed inset-x-5 top-4 z-30 flex h-[54px] items-center justify-between rounded-full px-5"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[17px] font-bold tracking-[0.22em] text-slate-900">
              MERIDIAN
            </span>
            <span className="hidden font-mono text-[10px] font-semibold tracking-[0.14em] text-slate-600 xl:inline">
              {t.brandSub}
            </span>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-white/80 bg-white/55 px-3 py-1 sm:flex">
            <span
              className={`h-2 w-2 rounded-full ${
                chain.rpcStatus === "live"
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                  : chain.rpcStatus === "syncing"
                    ? "animate-pulse bg-sky-500"
                    : "bg-amber-500"
              }`}
            />
            <span className="font-mono text-[10px] font-bold tracking-wider text-slate-700">
              {!MERIDIAN_DEPLOYED
                ? t.networkPendingDeployment
                : chain.rpcStatus === "live"
                  ? t.networkLive
                  : chain.rpcStatus === "syncing"
                    ? t.networkSyncing
                    : t.networkOffline}
            </span>
            <button
              type="button"
              onClick={() => void chain.refreshClaims()}
              title={chain.readError ?? "Refresh On-Chain State"}
              className="text-slate-500 transition hover:text-slate-900"
            >
              <RefreshCw
                className={`h-3 w-3 ${
                  chain.rpcStatus === "syncing" ? "animate-spin" : ""
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleDemo}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-bold tracking-wide transition ${
              demoOpen
                ? "bg-sky-600 text-white shadow-[0_6px_18px_rgba(2,132,199,0.38)]"
                : "meridian-glass-pill text-sky-900 hover:bg-white/95"
            }`}
          >
            <Play className="h-3 w-3 fill-current" />
            <span>{t.demoBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => setLocale((l) => (l === "en" ? "zh" : "en"))}
            className="meridian-glass-pill inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold text-slate-800 transition hover:bg-white/95"
            title="Switch Language"
          >
            <Languages className="h-3.5 w-3.5 text-sky-700" />
            <span>{locale === "en" ? "EN / 中文" : "中文 / EN"}</span>
          </button>

          <button
            type="button"
            onClick={toggleSound}
            title={audioEnabled ? t.soundOn : t.soundOff}
            className={`meridian-glass-pill inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
              audioEnabled
                ? "text-sky-700 ring-1 ring-sky-400/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {audioEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setPureOrbit((v) => !v)}
            title={pureOrbit ? t.exitPureOrbit : t.pureOrbit}
            className={`meridian-glass-pill hidden h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition md:inline-flex ${
              pureOrbit
                ? "text-sky-900 ring-1 ring-sky-400/80"
                : "text-slate-800 hover:bg-white/95"
            }`}
          >
            {pureOrbit ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            <span>{pureOrbit ? t.exitPureOrbit : t.pureOrbit}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              chain.resetTxFeedback();
              setSubmitModalOpen(true);
            }}
            className="meridian-glass-pill inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-bold tracking-wide text-slate-900 transition hover:bg-white/95"
          >
            <Plus className="h-3.5 w-3.5 text-sky-700" />
            <span>{t.submitClaim}</span>
          </button>

          <button
            type="button"
            onClick={() => setWalletModalOpen(true)}
            className={`meridian-glass-pill inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-semibold transition hover:bg-white/95 ${
              wallet.isConnected && !wallet.isCorrectNetwork
                ? "text-amber-900 ring-1 ring-amber-400"
                : "text-slate-900"
            }`}
          >
            <Wallet className="h-3.5 w-3.5 text-slate-600" />
            <span className="font-mono">
              {wallet.account
                ? formatShortAddress(wallet.account)
                : t.connectWallet}
            </span>
          </button>
        </div>
      </header>

      {/* Interactive 4-Stage Guided Walkthrough Card */}
      <DemoFlowBar
        open={demoOpen}
        step={demoStep}
        playing={demoPlaying}
        t={t}
        onSelectStep={(idx) => {
          setDemoPlaying(false);
          setDemoStep(idx);
        }}
        onTogglePlay={() => setDemoPlaying((p) => !p)}
        onClose={() => setDemoOpen(false)}
        onGlassMove={handleGlassMove}
      />

      {/* Interactive Validator Hub Inspector Card */}
      {selectedValidator && !demoOpen && (
        <div
          onPointerMove={handleGlassMove}
          className="meridian-glass fixed left-6 top-[84px] z-30 w-[290px] rounded-[22px] p-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] font-bold tracking-wider text-sky-700">
                {t.validatorCardTitle} · {selectedValidator.id}
              </div>
              <div className="mt-0.5 text-sm font-bold text-slate-900">
                {selectedValidator.city} Hub
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedValidatorId(null)}
              className="rounded-full p-1 text-slate-500 hover:bg-white/75 hover:text-slate-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] text-slate-700">{t.validatorRole}</p>
          <div className="mt-2 flex items-center justify-between font-mono text-[10.5px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)]" />
              {t.validatorStatusOnline}
            </span>
            <span className="text-slate-600">
              {selectedValidator.lat.toFixed(1)}°, {selectedValidator.lng.toFixed(1)}°
            </span>
          </div>
          <button
            type="button"
            onClick={() => issueGlobeCommand("SONAR")}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600/90 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-sky-700"
          >
            <Radio className="h-3.5 w-3.5" />
            <span>{t.validatorPingBtn}</span>
          </button>
        </div>
      )}

      {/* Floating Hover Tooltip directly over Claim Beacons */}
      {hoveredBeacon && (
        <div
          style={{
            left: `${Math.min(window.innerWidth - 260, Math.max(16, hoveredBeacon.x + 18))}px`,
            top: `${Math.max(76, hoveredBeacon.y - 68)}px`,
          }}
          className="pointer-events-none fixed z-30 w-[236px] rounded-2xl border border-white/85 bg-white/88 p-2.5 shadow-lg backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-bold text-sky-800">
              {hoveredBeacon.claim.claim_id}
            </span>
            <span className="rounded-full bg-sky-100/90 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-700">
              {hoveredBeacon.claim.status}
            </span>
          </div>
          <div className="mt-1 line-clamp-2 text-[11.5px] font-bold leading-snug text-slate-900">
            {hoveredBeacon.claim.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-slate-600">
            {hoveredBeacon.claim.region_label}
          </div>
        </div>
      )}

      {/* Active Pin-on-Globe Guidance Banner */}
      {pinMode && (
        <div className="fixed left-1/2 top-[84px] z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-sky-200 bg-white/88 px-5 py-2 shadow-lg backdrop-blur-xl">
          <Crosshair className="h-4 w-4 animate-pulse text-sky-600" />
          <span className="text-xs font-semibold text-slate-900">
            {t.pinActiveBanner}
          </span>
          <button
            type="button"
            onClick={() => {
              setPinMode(false);
              setSubmitModalOpen(true);
            }}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
          >
            {t.cancelPin}
          </button>
        </div>
      )}

      {/* Bottom-Left Floating Filter + Cinematic Orbit Cruise Capsule */}
      <div
        onPointerMove={handleGlassMove}
        className="meridian-glass fixed bottom-5 left-5 z-20 flex flex-wrap items-center gap-2 rounded-full px-3 py-2"
      >
        <div className="flex items-center gap-1 border-r border-white/75 pr-2">
          <button
            type="button"
            onClick={() => stepCruise(-1)}
            disabled={filteredClaims.length <= 1}
            title={t.cruiseHint}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/75 text-slate-800 transition hover:bg-white disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => stepCruise(1)}
            disabled={filteredClaims.length <= 1}
            title={t.cruiseHint}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/75 text-slate-800 transition hover:bg-white disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {filterItems.map((item) => {
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide transition ${
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-700 hover:bg-white/80 hover:text-slate-950"
                }`}
              >
                {item.label}
                <span className="ml-1 font-mono opacity-75">{item.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom-Right Interactive Earth Telemetry, Skin & Planet Controls */}
      <div
        onPointerMove={handleGlassMove}
        className="meridian-glass fixed bottom-5 right-6 z-20 hidden items-center gap-1.5 rounded-full px-3 py-1.5 lg:flex"
      >
        <div className="flex items-center gap-1.5 border-r border-white/75 pr-2 font-mono text-[10.5px] font-semibold text-slate-700">
          <Compass className="h-3.5 w-3.5 text-sky-700" />
          {cursorCoords ? (
            <span>
              {Math.abs(cursorCoords.lat).toFixed(1)}°
              {cursorCoords.lat >= 0 ? "N" : "S"}{" "}
              {Math.abs(cursorCoords.lng).toFixed(1)}°
              {cursorCoords.lng >= 0 ? "E" : "W"}
            </span>
          ) : (
            <span className="max-w-[175px] truncate text-[10px] font-medium text-slate-600">
              {t.globeInteractionTip}
            </span>
          )}
        </div>

        {/* Cycle Earth Skin: Real Earth -> Orbital Twilight -> Crystal */}
        <button
          type="button"
          onClick={cycleTheme}
          title={themeLabel}
          className="inline-flex h-7 items-center gap-1 rounded-full bg-white/80 px-2.5 text-[10.5px] font-bold text-sky-900 transition hover:bg-white"
        >
          <Globe2 className="h-3.5 w-3.5 text-sky-600" />
          <span>{themeLabel}</span>
        </button>

        {/* Live Volumetric Cloud Layer Toggle (for Real Earth & Twilight modes) */}
        {globeTheme !== "crystal" && (
          <button
            type="button"
            onClick={() => setShowClouds((c) => !c)}
            title={t.globeControlsClouds}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
              showClouds
                ? "bg-sky-600/90 text-white shadow-sm"
                : "bg-white/70 text-slate-600 hover:bg-white"
            }`}
          >
            <Cloud className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setAutoSpin((s) => !s)}
          title={autoSpin ? t.globeControlsPause : t.globeControlsSpin}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-slate-800 transition hover:bg-white"
        >
          {autoSpin ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => issueGlobeCommand("SONAR")}
          title={t.globeControlsSonar}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-sky-700 transition hover:bg-white"
        >
          <Radio className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => issueGlobeCommand("ZOOM_OUT")}
          title="Zoom Out"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-slate-800 transition hover:bg-white"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => issueGlobeCommand("ZOOM_IN")}
          title="Zoom In"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-slate-800 transition hover:bg-white"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => issueGlobeCommand("RESET")}
          title={t.globeControlsReset}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-slate-800 transition hover:bg-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Right Floating VisionOS Liquid-Glass Dossier */}
      {!pureOrbit && (
        <DossierCard
          claim={selectedClaim}
          loading={chain.rpcStatus === "syncing"}
          t={t}
          isConnected={wallet.isConnected}
          isAdjudicating={
            Boolean(selectedClaim) &&
            chain.adjudicatingClaimId === selectedClaim?.claim_id
          }
          adjudicationStage={
            demoOpen && demoStep === 2 ? 5 : chain.adjudicationStage
          }
          txFeedback={chain.txFeedback}
          onAdjudicate={(id) => void chain.adjudicateClaim(id)}
          onOpenWallet={() => setWalletModalOpen(true)}
          onEnterPureOrbit={() => setPureOrbit(true)}
          onResetTx={chain.resetTxFeedback}
          onGlassMove={handleGlassMove}
        />
      )}

      {/* Submit Claim Modal */}
      <SubmitClaimModal
        open={submitModalOpen}
        t={t}
        isConnected={wallet.isConnected}
        pinnedCoords={pinnedCoords}
        txFeedback={chain.txFeedback}
        onClose={() => setSubmitModalOpen(false)}
        onStartPinMode={() => {
          setSubmitModalOpen(false);
          setPinMode(true);
        }}
        onOpenWallet={() => setWalletModalOpen(true)}
        onSubmit={handleSubmitClaim}
        onGlassMove={handleGlassMove}
      />

      {/* Multi-Wallet EIP-6963 Connection Modal */}
      <WalletModal
        open={walletModalOpen}
        t={t}
        wallets={wallet.wallets}
        activeWallet={wallet.activeWallet}
        account={wallet.account}
        isCorrectNetwork={wallet.isCorrectNetwork}
        connecting={wallet.connecting}
        walletError={wallet.walletError}
        onClose={() => {
          wallet.clearWalletError();
          setWalletModalOpen(false);
        }}
        onConnect={wallet.connectWallet}
        onDisconnect={wallet.disconnectWallet}
        onSwitchNetwork={() => wallet.ensureStudioNet()}
        onGlassMove={handleGlassMove}
      />
    </div>
  );
}

export default App;
