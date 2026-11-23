import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Crosshair,
  Loader2,
  MapPin,
  Wallet,
  X,
} from "lucide-react";
import {
  ALLOWED_CATEGORIES,
  MERIDIAN_NETWORK,
  PRESET_LOCATIONS,
  formatShortAddress,
  type ClaimCategory,
} from "../../config/meridian";
import type { Messages } from "../../i18n/messages";
import type { DiscoveredWallet } from "../../hooks/useMultiWallet";
import type {
  SubmitClaimPayload,
  TxFeedbackState,
} from "../../hooks/useMeridianChain";

interface SubmitClaimModalProps {
  open: boolean;
  t: Messages;
  isConnected: boolean;
  pinnedCoords: { lat: number; lng: number } | null;
  txFeedback: TxFeedbackState;
  onClose: () => void;
  onStartPinMode: () => void;
  onOpenWallet: () => void;
  onSubmit: (payload: SubmitClaimPayload) => Promise<void>;
  onGlassMove: (e: React.PointerEvent<HTMLElement>) => void;
}

export const SubmitClaimModal: React.FC<SubmitClaimModalProps> = ({
  open,
  t,
  isConnected,
  pinnedCoords,
  txFeedback,
  onClose,
  onStartPinMode,
  onOpenWallet,
  onSubmit,
  onGlassMove,
}) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ClaimCategory>("PROTOCOL");
  const [regionLabel, setRegionLabel] = useState("Zurich, CH");
  const [lat, setLat] = useState(47.3769);
  const [lng, setLng] = useState(8.5417);
  const [criteria, setCriteria] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState("https://");
  const [secondaryUrl, setSecondaryUrl] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!pinnedCoords) return;
    setLat(Number(pinnedCoords.lat.toFixed(4)));
    setLng(Number(pinnedCoords.lng.toFixed(4)));
    setRegionLabel(
      `${Math.abs(pinnedCoords.lat).toFixed(1)}°${pinnedCoords.lat >= 0 ? "N" : "S"}, ${Math.abs(pinnedCoords.lng).toFixed(1)}°${pinnedCoords.lng >= 0 ? "E" : "W"}`
    );
  }, [pinnedCoords]);

  if (!open) return null;

  const isBusy =
    txFeedback.targetClaimId === null &&
    txFeedback.phase !== "IDLE" &&
    txFeedback.phase !== "FINALIZED" &&
    txFeedback.phase !== "FAILED";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!title.trim() || !criteria.trim() || !regionLabel.trim()) {
      setLocalError("Please complete headline, location, and resolution criteria.");
      return;
    }
    if (!primaryUrl.trim().startsWith("https://")) {
      setLocalError("Primary URL must start with https://");
      return;
    }
    if (secondaryUrl.trim() && !secondaryUrl.trim().startsWith("https://")) {
      setLocalError("Secondary URL must start with https://");
      return;
    }
    await onSubmit({
      title,
      category,
      regionLabel,
      lat,
      lng,
      criteria,
      primaryUrl,
      secondaryUrl,
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/15 p-4 backdrop-blur-[6px]">
      <div
        onPointerMove={onGlassMove}
        className="meridian-glass w-full max-w-[520px] rounded-[28px] p-6"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/60 pb-3.5">
          <div>
            <h2 className="text-base font-bold text-slate-900">{t.modalTitle}</h2>
            <p className="mt-0.5 text-xs text-slate-600">{t.modalSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 hover:bg-white/70 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">
              {t.fieldTitle}
            </label>
            <input
              type="text"
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. HTTP GET is defined as a safe method"
              className="w-full rounded-xl border border-white/80 bg-white/65 px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                {t.fieldCategory}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ClaimCategory)}
                className="w-full rounded-xl border border-white/80 bg-white/65 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400"
              >
                {ALLOWED_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                {t.fieldRegion}
              </label>
              <input
                type="text"
                maxLength={64}
                value={regionLabel}
                onChange={(e) => setRegionLabel(e.target.value)}
                className="w-full rounded-xl border border-white/80 bg-white/65 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {/* Coordinate Picker: Pin-on-Globe + Quick City Presets */}
          <div className="rounded-2xl border border-white/75 bg-white/45 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-sky-600" />
                <span>
                  {lat.toFixed(2)}, {lng.toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={onStartPinMode}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/80 bg-sky-50/90 px-3 py-1 text-[11px] font-semibold text-sky-800 transition hover:bg-sky-100"
              >
                <Crosshair className="h-3.5 w-3.5" />
                {t.pinOnGlobeBtn}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESET_LOCATIONS.map((loc) => (
                <button
                  key={loc.label}
                  type="button"
                  onClick={() => {
                    setRegionLabel(loc.label);
                    setLat(loc.lat);
                    setLng(loc.lng);
                  }}
                  className="rounded-full border border-white/80 bg-white/60 px-2.5 py-0.5 text-[10.5px] text-slate-600 transition hover:bg-white hover:text-slate-900"
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">
              {t.fieldCriteria}
            </label>
            <textarea
              rows={2}
              maxLength={400}
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              placeholder="As of 2014-06; section 4.2.1; GET is explicitly defined as safe."
              className="w-full resize-none rounded-xl border border-white/80 bg-white/65 px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400"
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                {t.fieldPrimaryUrl}
              </label>
              <input
                type="url"
                value={primaryUrl}
                onChange={(e) => setPrimaryUrl(e.target.value)}
                className="w-full rounded-xl border border-white/80 bg-white/65 px-3 py-2 font-mono text-[11px] text-slate-900 outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                {t.fieldSecondaryUrl}
              </label>
              <input
                type="url"
                value={secondaryUrl}
                onChange={(e) => setSecondaryUrl(e.target.value)}
                placeholder="https://www.rfc-editor.org/rfc/rfc7231.txt"
                className="w-full rounded-xl border border-white/80 bg-white/65 px-3 py-2 font-mono text-[11px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400"
              />
            </div>
          </div>

          {(localError || (txFeedback.phase === "FAILED" && txFeedback.error)) && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-[11px] text-rose-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{localError || txFeedback.error}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="font-mono text-[10.5px] text-slate-500">
              {t.gaslessHint}
            </span>
            {isConnected ? (
              <button
                type="submit"
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 px-5 py-2 text-xs font-semibold text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
              >
                {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isBusy ? t.submittingBtn : t.submitBtn}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenWallet}
                className="meridian-glass-pill rounded-full px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-white/85"
              >
                {t.connectWallet}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

interface WalletModalProps {
  open: boolean;
  t: Messages;
  wallets: DiscoveredWallet[];
  activeWallet: DiscoveredWallet | null;
  account: string | null;
  isCorrectNetwork: boolean;
  connecting: boolean;
  walletError: string | null;
  onClose: () => void;
  onConnect: (wallet: DiscoveredWallet) => Promise<boolean>;
  onDisconnect: () => void;
  onSwitchNetwork: () => Promise<boolean>;
  onGlassMove: (e: React.PointerEvent<HTMLElement>) => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  open,
  t,
  wallets,
  activeWallet,
  account,
  isCorrectNetwork,
  connecting,
  walletError,
  onClose,
  onConnect,
  onDisconnect,
  onSwitchNetwork,
  onGlassMove,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/15 p-4 backdrop-blur-[6px]">
      <div
        onPointerMove={onGlassMove}
        className="meridian-glass w-full max-w-[400px] rounded-[28px] p-6"
      >
        <div className="flex items-start justify-between border-b border-white/60 pb-3.5">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {t.walletModalTitle}
            </h2>
            <p className="mt-0.5 text-[11.5px] text-slate-600">
              {t.walletModalSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 hover:bg-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {account && activeWallet && (
          <div className="mt-4 rounded-2xl border border-white/80 bg-white/60 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {activeWallet.info.icon ? (
                  <img
                    src={activeWallet.info.icon}
                    alt={activeWallet.info.name}
                    className="h-6 w-6 rounded-lg"
                  />
                ) : (
                  <Wallet className="h-5 w-5 text-sky-600" />
                )}
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    {activeWallet.info.name}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">
                    {formatShortAddress(account)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onDisconnect}
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-600 hover:text-rose-600"
              >
                {t.walletDisconnect}
              </button>
            </div>

            {!isCorrectNetwork && (
              <button
                type="button"
                onClick={() => void onSwitchNetwork()}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500/90 py-2 text-xs font-semibold text-white hover:bg-amber-600"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {t.walletSwitchNetwork}
              </button>
            )}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <div className="font-mono text-[10px] font-semibold tracking-wider text-slate-500">
            {t.walletDetected} ({wallets.length})
          </div>

          {wallets.length === 0 ? (
            <div className="rounded-2xl border border-white/75 bg-white/50 p-3.5 text-xs leading-relaxed text-slate-600">
              {t.walletNoneDetected}
            </div>
          ) : (
            wallets.map((w) => {
              const isActive = activeWallet?.info.rdns === w.info.rdns && Boolean(account);
              return (
                <button
                  key={w.info.uuid}
                  type="button"
                  disabled={connecting}
                  onClick={async () => {
                    const ok = await onConnect(w);
                    if (ok) onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/80 bg-white/55 px-3.5 py-2.5 text-left transition hover:bg-white/85 disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    {w.info.icon ? (
                      <img
                        src={w.info.icon}
                        alt={w.info.name}
                        className="h-7 w-7 rounded-lg"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                        <Wallet className="h-4 w-4" />
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        {w.info.name}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        Chain {MERIDIAN_NETWORK.chainId} · EIP-6963
                      </div>
                    </div>
                  </div>
                  {isActive ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {walletError && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-[11px] text-rose-700">
            {walletError}
          </div>
        )}
      </div>
    </div>
  );
};
