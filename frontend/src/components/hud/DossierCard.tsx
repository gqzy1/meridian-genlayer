import React, { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  EyeOff,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  X,
} from "lucide-react";
import {
  MERIDIAN_CONTRACT_ADDRESS,
  MERIDIAN_NETWORK,
  VALIDATOR_HUBS,
  formatCoords,
  formatShortAddress,
  type ClaimRecord,
  type ClaimStatus,
} from "../../config/meridian";
import type { Messages } from "../../i18n/messages";
import type { TxFeedbackState } from "../../hooks/useMeridianChain";

interface DossierCardProps {
  claim: ClaimRecord | null;
  loading: boolean;
  t: Messages;
  isConnected: boolean;
  isAdjudicating: boolean;
  adjudicationStage: number; // 0..5
  txFeedback: TxFeedbackState;
  onAdjudicate: (claimId: string) => void;
  onOpenWallet: () => void;
  onEnterPureOrbit: () => void;
  onResetTx: () => void;
  onGlassMove: (e: React.PointerEvent<HTMLElement>) => void;
}

const ARCH_POSITIONS = [
  { x: 24, y: 74 },
  { x: 66, y: 34 },
  { x: 126, y: 18 },
  { x: 186, y: 34 },
  { x: 228, y: 74 },
];

function getHexPalette(status: ClaimStatus | "ADJUDICATING") {
  switch (status) {
    case "VERIFIED":
      return {
        bg: "from-emerald-300/60 via-teal-200/45 to-emerald-400/40",
        border: "rgba(16, 185, 129, 0.62)",
        glow: "0 10px 28px rgba(16, 185, 129, 0.30)",
        text: "text-emerald-950",
        icon: <ShieldCheck className="h-5 w-5 text-emerald-700" />,
      };
    case "REFUTED":
      return {
        bg: "from-rose-300/60 via-pink-200/45 to-rose-400/40",
        border: "rgba(244, 63, 94, 0.58)",
        glow: "0 10px 28px rgba(244, 63, 94, 0.28)",
        text: "text-rose-950",
        icon: <ShieldAlert className="h-5 w-5 text-rose-700" />,
      };
    case "ADJUDICATING":
      return {
        bg: "from-amber-200/70 via-yellow-100/50 to-amber-300/50",
        border: "rgba(245, 158, 11, 0.62)",
        glow: "0 10px 28px rgba(245, 158, 11, 0.32)",
        text: "text-amber-950",
        icon: <Loader2 className="h-5 w-5 animate-spin text-amber-700" />,
      };
    case "INCONCLUSIVE":
      return {
        bg: "from-slate-200/70 via-white/60 to-slate-300/50",
        border: "rgba(100, 116, 139, 0.5)",
        glow: "0 10px 24px rgba(100, 116, 139, 0.20)",
        text: "text-slate-800",
        icon: <ShieldQuestion className="h-5 w-5 text-slate-600" />,
      };
    default:
      return {
        bg: "from-sky-200/70 via-cyan-100/50 to-sky-300/45",
        border: "rgba(14, 165, 233, 0.56)",
        glow: "0 10px 26px rgba(14, 165, 233, 0.26)",
        text: "text-sky-950",
        icon: <Sparkles className="h-5 w-5 text-sky-700" />,
      };
  }
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const DossierCard: React.FC<DossierCardProps> = ({
  claim,
  loading,
  t,
  isConnected,
  isAdjudicating,
  adjudicationStage,
  txFeedback,
  onAdjudicate,
  onOpenWallet,
  onEnterPureOrbit,
  onResetTx,
  onGlassMove,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showFingerprint, setShowFingerprint] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [hexTilt, setHexTilt] = useState({ rx: 0, ry: 0, sheenX: 50 });

  const copyValue = async (key: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedField(key);
      window.setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // Ignore clipboard fallback
    }
  };

  if (!claim) {
    return (
      <aside
        onPointerMove={onGlassMove}
        className="meridian-glass fixed right-6 top-1/2 z-20 w-[356px] -translate-y-1/2 rounded-[26px] p-6"
      >
        <div className="flex items-center gap-3 text-slate-700">
          <Loader2 className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span className="text-sm font-medium">
            {loading ? t.networkSyncing : "No claims match current filter."}
          </span>
        </div>
      </aside>
    );
  }

  const visualStatus = isAdjudicating ? "ADJUDICATING" : claim.status;
  const hexStyle = getHexPalette(visualStatus);
  const isThisClaimTx =
    txFeedback.targetClaimId === claim.claim_id && txFeedback.phase !== "IDLE";

  const litNodes = isAdjudicating
    ? adjudicationStage
    : claim.adjudications > 0
      ? 5
      : 0;

  const txPhaseLabel =
    txFeedback.phase === "SWITCHING_NETWORK"
      ? t.txSwitching
      : txFeedback.phase === "AWAITING_SIGNATURE"
        ? t.txSignPrompt
        : txFeedback.phase === "SUBMITTED"
          ? t.txSubmitted
          : txFeedback.phase === "FETCHING_WEB"
            ? t.txFetchingWeb
            : txFeedback.phase === "VALIDATORS_VOTING"
              ? t.txValidatorsVoting
              : txFeedback.phase === "FINALIZED"
                ? t.txFinalized
                : txFeedback.error || t.txFailed;

  return (
    <aside
      onPointerMove={onGlassMove}
      className="meridian-glass fixed right-6 top-1/2 z-20 flex max-h-[75vh] w-[362px] max-w-[calc(100vw-2.5rem)] -translate-y-1/2 flex-col rounded-[28px] p-5 transition-all duration-300"
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 border-b border-white/65 pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-bold tracking-wider text-slate-600">
              {t.caseHeader}: {claim.claim_id}
            </span>
            <span className="rounded-full bg-white/75 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-sky-900">
              {claim.category}
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-slate-600">
            {claim.region_label} · {formatCoords(claim.lat_e4, claim.lng_e4)}
          </p>
        </div>
        <button
          type="button"
          onClick={onEnterPureOrbit}
          title={t.pureOrbit}
          className="shrink-0 rounded-full p-1.5 text-slate-600 transition hover:bg-white/75 hover:text-slate-900"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Inner Body */}
      <div className="thin-scroll mt-3.5 flex-1 space-y-3.5 overflow-y-auto pr-1">
        {/* Title + 3D Prismatic Hexagonal Verdict Crystal */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold leading-snug text-slate-900">
              {claim.title}
            </h2>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-700 line-clamp-3">
              {claim.criteria}
            </p>
          </div>

          {/* Interactive 3D Tilting Hexagonal Crystal Badge */}
          <button
            type="button"
            onClick={() => setShowFingerprint((v) => !v)}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const px = (e.clientX - rect.left) / rect.width;
              const py = (e.clientY - rect.top) / rect.height;
              setHexTilt({
                rx: (0.5 - py) * 24,
                ry: (px - 0.5) * 24,
                sheenX: px * 100,
              });
            }}
            onPointerLeave={() => setHexTilt({ rx: 0, ry: 0, sheenX: 50 })}
            style={{ perspective: "420px" }}
            className="group relative shrink-0 focus:outline-none"
            title={t.fingerprintTitle}
          >
            <div
              style={{
                transform: `rotateX(${hexTilt.rx}deg) rotateY(${hexTilt.ry}deg)`,
                boxShadow: hexStyle.glow,
                clipPath:
                  "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)",
                borderColor: hexStyle.border,
              }}
              className={`relative flex h-[92px] w-[84px] flex-col items-center justify-center bg-gradient-to-br ${hexStyle.bg} px-1.5 text-center backdrop-blur-md transition-transform duration-150`}
            >
              <div
                className="prism-sheen pointer-events-none absolute inset-0 opacity-80 transition-opacity group-hover:opacity-100"
                style={{
                  transform: `translateX(${(hexTilt.sheenX - 50) * 0.45}%)`,
                }}
              />
              <div className="relative z-10">{hexStyle.icon}</div>
              <span
                className={`relative z-10 mt-1 text-[9px] font-bold leading-tight tracking-wide ${hexStyle.text}`}
              >
                {t.statusLabels[claim.status] ?? claim.status}
              </span>
              {claim.confidence > 0 && (
                <span className="relative z-10 mt-0.5 font-mono text-[9px] font-bold text-slate-700">
                  {claim.confidence}%
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Clickable On-Chain Fingerprint Popover */}
        {showFingerprint && (
          <div className="rounded-2xl border border-white/85 bg-white/75 p-3 text-[11px] shadow-sm backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold text-slate-900">
                {t.fingerprintTitle}
              </span>
              <button
                type="button"
                onClick={() => setShowFingerprint(false)}
                className="text-slate-500 hover:text-slate-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1.5 font-mono text-[10.5px] text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t.contractLabel}</span>
                <button
                  type="button"
                  onClick={() =>
                    void copyValue("contract", MERIDIAN_CONTRACT_ADDRESS)
                  }
                  className="inline-flex items-center gap-1 font-semibold text-sky-800 hover:text-sky-950"
                >
                  {copiedField === "contract"
                    ? t.copyDone
                    : formatShortAddress(MERIDIAN_CONTRACT_ADDRESS)}
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t.chainLabel}</span>
                <span>StudioNet ({MERIDIAN_NETWORK.chainId})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t.submitterLabel}</span>
                <span>{formatShortAddress(claim.submitter)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t.adjudicatorLabel}</span>
                <span>
                  {claim.last_adjudicator
                    ? formatShortAddress(claim.last_adjudicator)
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Live Web Evidence Sources */}
        <div className="space-y-2 border-t border-white/65 pt-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold tracking-wider text-slate-600">
              {t.webSourcesLabel}
            </span>
            <span className="font-mono text-[10px] font-semibold text-slate-600">
              {t.adjudicationsCount}: {claim.adjudications}
            </span>
          </div>

          <a
            href={claim.primary_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2 rounded-xl border border-white/80 bg-white/55 px-2.5 py-2 text-[11.5px] transition hover:bg-white/85"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Check
                className={`h-3.5 w-3.5 shrink-0 ${
                  claim.primary_status === "REACHABLE"
                    ? "text-emerald-600"
                    : "text-sky-600"
                }`}
              />
              <span className="truncate font-semibold text-slate-800">
                {getHostname(claim.primary_url)}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="font-mono text-[9.5px] font-bold text-emerald-700">
                {t.sourceStates[claim.primary_status] ?? claim.primary_status}
              </span>
              <ExternalLink className="h-3 w-3 text-slate-500" />
            </div>
          </a>

          {claim.secondary_url && (
            <a
              href={claim.secondary_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 rounded-xl border border-white/80 bg-white/55 px-2.5 py-2 text-[11.5px] transition hover:bg-white/85"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Check
                  className={`h-3.5 w-3.5 shrink-0 ${
                    claim.secondary_status === "REACHABLE"
                      ? "text-emerald-600"
                      : "text-slate-500"
                  }`}
                />
                <span className="truncate font-semibold text-slate-800">
                  {getHostname(claim.secondary_url)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="font-mono text-[9.5px] font-bold text-slate-700">
                  {t.sourceStates[claim.secondary_status] ??
                    claim.secondary_status}
                </span>
                <ExternalLink className="h-3 w-3 text-slate-500" />
              </div>
            </a>
          )}
        </div>

        {/* Collapsible AI Reasoning & Verbatim Excerpt */}
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-[11.5px] font-semibold text-sky-900 transition hover:text-sky-950"
          >
            <span>{expanded ? t.collapseEvidence : t.expandEvidence}</span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {expanded && (
            <div className="mt-1.5 space-y-2 rounded-2xl border border-white/80 bg-white/60 p-3 text-[11.5px] leading-relaxed text-slate-800">
              <div>
                <div className="font-mono text-[9.5px] font-bold tracking-wider text-slate-500">
                  {t.verdictSummary}
                </div>
                <p className="mt-0.5">{claim.summary}</p>
              </div>
              {claim.evidence_excerpt && (
                <div className="border-t border-white/80 pt-2">
                  <div className="font-mono text-[9.5px] font-bold tracking-wider text-slate-500">
                    {t.evidenceExcerpt}
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] italic text-slate-700">
                    “{claim.evidence_excerpt}”
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Curved 5-Node Optimistic Democracy Consensus Arch */}
        <div className="relative flex flex-col items-center pt-1">
          <div className="relative h-[94px] w-[252px]">
            <svg
              viewBox="0 0 252 94"
              className="h-full w-full overflow-visible"
              aria-label="Optimistic Democracy Consensus Arch"
            >
              <defs>
                <linearGradient id="consensusArchGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.78" />
                  <stop offset="65%" stopColor="#34D399" stopOpacity="0.78" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.78" />
                </linearGradient>
              </defs>
              <path
                d="M 24 74 Q 126 -14 228 74"
                fill="none"
                stroke={litNodes > 0 ? "url(#consensusArchGrad)" : "rgba(100,128,158,0.42)"}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>

            {VALIDATOR_HUBS.map((hub, idx) => {
              const pos = ARCH_POSITIONS[idx];
              const isLit = idx < litNodes;
              const isFinalPulse = isAdjudicating && idx === litNodes;
              const isWarmAccent = idx === 4 && (isAdjudicating || claim.status === "REFUTED");
              return (
                <div
                  key={hub.id}
                  title={`${hub.id} · ${hub.city}`}
                  style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                  className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[10px] font-bold transition-all duration-500 ${
                    isLit
                      ? isWarmAccent
                        ? "border-amber-200 bg-amber-300/90 text-amber-950 shadow-[0_0_16px_rgba(245,158,11,0.65)]"
                        : "border-emerald-100 bg-emerald-300/90 text-emerald-950 shadow-[0_0_16px_rgba(16,185,129,0.62)]"
                      : isFinalPulse
                        ? "animate-pulse border-amber-200 bg-amber-200/85 text-amber-900 shadow-[0_0_14px_rgba(245,158,11,0.5)]"
                        : "border-white/85 bg-white/70 text-slate-600"
                  }`}
                >
                  {hub.id}
                </div>
              );
            })}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
              <div className="text-[11px] font-semibold text-slate-600">
                {t.consensusTitle}
              </div>
              <div className="text-[11.5px] font-bold tracking-tight text-slate-900">
                {t.consensusSubtitle}
              </div>
            </div>
          </div>
        </div>

        {/* Live Tx Lifecycle Status Banner */}
        {isThisClaimTx && (
          <div
            className={`rounded-2xl border p-2.5 text-[11px] ${
              txFeedback.phase === "FAILED"
                ? "border-rose-300/80 bg-rose-50/85 text-rose-800"
                : txFeedback.phase === "FINALIZED"
                  ? "border-emerald-300/80 bg-emerald-50/85 text-emerald-800"
                  : "border-sky-200/90 bg-white/75 text-slate-800"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                {txFeedback.phase === "FAILED" ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
                ) : txFeedback.phase === "FINALIZED" ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-sky-600" />
                )}
                <span className="leading-snug">{txPhaseLabel}</span>
              </div>
              {(txFeedback.phase === "FAILED" ||
                txFeedback.phase === "FINALIZED") && (
                <button
                  type="button"
                  onClick={onResetTx}
                  className="text-slate-500 hover:text-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {txFeedback.txHash && (
              <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] opacity-85">
                <span>
                  {t.txHashLabel}: {formatShortAddress(txFeedback.txHash)}
                </span>
                <button
                  type="button"
                  onClick={() => void copyValue("tx", txFeedback.txHash!)}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  {copiedField === "tx" ? t.copyDone : "Copy"}
                  <Copy className="h-2.5 w-2.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Primary Action Button */}
      <div className="mt-3.5 border-t border-white/65 pt-3">
        {isConnected ? (
          <button
            type="button"
            disabled={isAdjudicating}
            onClick={() => onAdjudicate(claim.claim_id)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/85 bg-gradient-to-r from-sky-600 via-cyan-600 to-emerald-500 px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_10px_24px_rgba(14,116,184,0.34)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isAdjudicating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t.adjudicatingBtn}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>
                  {claim.adjudications > 0
                    ? t.readjudicateBtn
                    : t.adjudicateBtn}
                </span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenWallet}
            className="meridian-glass-pill flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[12.5px] font-bold text-slate-900 transition hover:bg-white/90"
          >
            <span>{t.connectToAdjudicate}</span>
          </button>
        )}
      </div>
    </aside>
  );
};
