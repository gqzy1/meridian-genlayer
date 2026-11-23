import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import type { Messages } from "../../i18n/messages";

interface DemoFlowBarProps {
  open: boolean;
  step: number; // 0..3
  playing: boolean;
  t: Messages;
  onSelectStep: (idx: number) => void;
  onTogglePlay: () => void;
  onClose: () => void;
  onGlassMove: (e: React.PointerEvent<HTMLElement>) => void;
}

export const DemoFlowBar: React.FC<DemoFlowBarProps> = ({
  open,
  step,
  playing,
  t,
  onSelectStep,
  onTogglePlay,
  onClose,
  onGlassMove,
}) => {
  if (!open) return null;
  const total = t.demoSteps.length;
  const current = t.demoSteps[step] ?? t.demoSteps[0];

  return (
    <div
      onPointerMove={onGlassMove}
      className="meridian-glass fixed left-6 top-[84px] z-30 w-[390px] max-w-[calc(100vw-3rem)] rounded-[24px] p-4 shadow-xl"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/80 bg-sky-50/85 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-sky-800">
          <Sparkles className="h-3 w-3 text-sky-600" />
          <span>{t.demoBadge}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title={t.demoExit}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-white/75 hover:text-slate-900"
        >
          <span>{t.demoExit}</span>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2.5">
        <div className="font-mono text-[10px] font-semibold tracking-wider text-sky-700">
          {current.tag}
        </div>
        <h3 className="mt-0.5 text-[14px] font-bold text-slate-900">
          {current.title}
        </h3>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-700">
          {current.desc}
        </p>
      </div>

      {/* Step progress dots + playback controls */}
      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-white/65 pt-2.5">
        <div className="flex items-center gap-1.5">
          {t.demoSteps.map((s, idx) => (
            <button
              key={s.tag}
              type="button"
              onClick={() => onSelectStep(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === step
                  ? "w-7 bg-sky-600 shadow-[0_0_8px_rgba(2,132,199,0.55)]"
                  : idx < step
                    ? "w-2.5 bg-emerald-500/80"
                    : "w-2.5 bg-slate-400/45 hover:bg-slate-500/70"
              }`}
              aria-label={s.title}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectStep((step - 1 + total) % total)}
            className="meridian-glass-pill flex h-7 w-7 items-center justify-center rounded-full text-slate-700 hover:bg-white"
            title={t.demoPrev}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            className="meridian-glass-pill inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-sky-900 hover:bg-white"
          >
            {playing ? (
              <>
                <Pause className="h-3 w-3" />
                <span>{t.demoPause}</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                <span>{t.demoPlay}</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => onSelectStep((step + 1) % total)}
            className="meridian-glass-pill flex h-7 w-7 items-center justify-center rounded-full text-slate-700 hover:bg-white"
            title={t.demoNext}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
