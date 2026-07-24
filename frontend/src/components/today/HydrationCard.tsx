"use client";

import { useEffect, useRef, useState } from "react";
import { Card, useToast } from "@/components/ui";
import { deleteIntake, logWaterSip } from "@/lib/api";
import { cn } from "@/lib/cn";
import { WaterWaveDrop } from "./WaterWaveDrop";

const SIP_ML = 30;
const CUP_ML = 250;
const HOLD_MS = 1000;
const DEFAULT_CUPS = 8;

/**
 * Hold-to-fill water card.
 * Fill only advances on committed sips (never snaps back on release).
 * Every 1s while held commits 1 sip (30 ml).
 */
export function HydrationCard({
  ml,
  targetCups,
  onChanged,
}: {
  ml: number;
  targetCups: number;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [committedMl, setCommittedMl] = useState(ml);
  /** Preview ml for the in-progress sip (0 → SIP_ML). Does not lower the bars on release. */
  const [pourMl, setPourMl] = useState(0);
  const [holding, setHolding] = useState(false);

  const sipStack = useRef<number[]>([]);
  const holdingRef = useRef(false);
  const sipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const pourAnchor = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const sipInFlight = useRef(false);
  const pendingRefresh = useRef(false);
  const undoingRef = useRef(false);
  const committedRef = useRef(ml);

  const cupsCount = Math.max(1, targetCups || DEFAULT_CUPS);

  useEffect(() => {
    committedRef.current = committedMl;
  }, [committedMl]);

  // Sync from parent, but never drop below local optimistic total (unless undoing).
  useEffect(() => {
    if (undoingRef.current) {
      setCommittedMl(ml);
      committedRef.current = ml;
      undoingRef.current = false;
      return;
    }
    if (ml > committedRef.current) {
      setCommittedMl(ml);
      committedRef.current = ml;
    }
  }, [ml]);

  useEffect(() => {
    return () => {
      holdingRef.current = false;
      if (sipTimer.current) clearTimeout(sipTimer.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const targetMl = cupsCount * CUP_ML;
  // Committed fill only — release never snaps the droplet/bars down.
  const displayMl = Math.min(targetMl, committedMl);
  const cups = Math.min(cupsCount, Math.floor(displayMl / CUP_ML));
  const overallPct =
    targetMl > 0 ? Math.min(100, (displayMl / targetMl) * 100) : 0;
  const pourProgress = holding ? Math.min(1, pourMl / SIP_ML) : 0;

  function stopAnim() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function flushRefresh() {
    if (pendingRefresh.current) {
      pendingRefresh.current = false;
      onChanged?.();
    }
  }

  function stopHold() {
    holdingRef.current = false;
    setHolding(false);
    if (sipTimer.current) {
      clearTimeout(sipTimer.current);
      sipTimer.current = null;
    }
    stopAnim();
    setPourMl(0);
    pointerIdRef.current = null;
    flushRefresh();
  }

  function startPourAnim() {
    pourAnchor.current = performance.now();
    stopAnim();
    const tick = () => {
      if (!holdingRef.current) return;
      const elapsed = performance.now() - pourAnchor.current;
      const partial = Math.min(SIP_ML, (elapsed / HOLD_MS) * SIP_ML);
      setPourMl(partial);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function addSip() {
    if (sipInFlight.current) return;
    if (committedRef.current >= targetMl) {
      stopHold();
      return;
    }
    sipInFlight.current = true;
    const next = Math.min(targetMl, committedRef.current + SIP_ML);
    committedRef.current = next;
    setCommittedMl(next);
    setPourMl(0);
    pourAnchor.current = performance.now();
    try {
      const res = await logWaterSip(SIP_ML);
      sipStack.current.push(res.intake_id);
      // Defer parent refresh until hold ends so stale fetches can't erase fill.
      pendingRefresh.current = true;
    } catch (err) {
      const rolled = Math.max(0, committedRef.current - SIP_ML);
      committedRef.current = rolled;
      setCommittedMl(rolled);
      stopHold();
      const msg = err instanceof Error ? err.message : "Backend unreachable";
      toast({
        title: "Couldn't log sip",
        description: msg,
        variant: "error",
      });
    } finally {
      sipInFlight.current = false;
    }
  }

  function scheduleNextSip() {
    if (sipTimer.current) clearTimeout(sipTimer.current);
    sipTimer.current = setTimeout(() => {
      if (!holdingRef.current) return;
      void addSip().finally(() => {
        if (holdingRef.current) {
          startPourAnim();
          scheduleNextSip();
        }
      });
    }, HOLD_MS);
  }

  async function undoSip() {
    const last = sipStack.current.pop();
    if (last == null) {
      toast({
        title: "Nothing to undo",
        description: "Hold to pour a sip first",
        variant: "info",
      });
      return;
    }
    undoingRef.current = true;
    const next = Math.max(0, committedRef.current - SIP_ML);
    committedRef.current = next;
    setCommittedMl(next);
    setPourMl(0);
    try {
      await deleteIntake(last);
      onChanged?.();
      toast({
        title: "Sip undone",
        description: `−${SIP_ML} ml`,
        variant: "info",
      });
    } catch {
      undoingRef.current = false;
      const restored = committedRef.current + SIP_ML;
      committedRef.current = restored;
      setCommittedMl(restored);
      sipStack.current.push(last);
      toast({ title: "Undo failed", variant: "error" });
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (committedRef.current >= targetMl) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    holdingRef.current = true;
    setHolding(true);
    startPourAnim();
    scheduleNextSip();
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (
      pointerIdRef.current != null &&
      e.pointerId !== pointerIdRef.current
    ) {
      return;
    }
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
    stopHold();
  }

  return (
    <Card className="flex h-full flex-col p-4 md:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-ink">Add water</span>
        <span className="text-[11px] font-semibold text-ink-3">
          Goal: {cupsCount} cups
        </span>
      </div>

      <p className="mt-3 text-[13px] font-semibold text-ink-2">
        {Math.round(displayMl)} ml of {targetMl} ml · {cups} of {cupsCount}{" "}
        cups
      </p>

      <div className="mt-4">
        <WaterWaveDrop pct={overallPct} pouring={holding} />
      </div>

      {/* Cup bars — only committed fill (no snap-back) */}
      <div className="mt-4 flex gap-1.5">
        {Array.from({ length: cupsCount }).map((_, i) => {
          const start = i * CUP_ML;
          const filledInCup = Math.max(
            0,
            Math.min(CUP_ML, displayMl - start),
          );
          const pct = (filledInCup / CUP_ML) * 100;
          const isActiveCup =
            holding &&
            displayMl < targetMl &&
            displayMl >= start &&
            displayMl < start + CUP_ML;
          return (
            <div
              key={i}
              className={cn(
                "relative h-2.5 flex-1 overflow-hidden rounded-sm bg-line",
                isActiveCup && "ring-1 ring-blue/40",
              )}
            >
              <div
                className="absolute inset-y-0 left-0 bg-blue"
                style={{
                  width: `${pct}%`,
                  transition: "width 280ms ease-out",
                }}
              />
              {isActiveCup && (
                <div
                  className="absolute inset-y-0 bg-blue/35"
                  style={{
                    left: `${pct}%`,
                    width: `${((SIP_ML * pourProgress) / CUP_ML) * 100}%`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          aria-label="Undo last sip"
          onClick={() => void undoSip()}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-card-sm border border-line text-[18px] font-bold text-ink-2 hover:bg-app-bg"
        >
          −
        </button>
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={stopHold}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "flex h-11 flex-1 touch-none select-none items-center justify-center rounded-card-sm text-[14px] font-bold text-white transition-colors",
            holding ? "bg-blue-d scale-[0.99]" : "bg-blue hover:bg-blue-d",
          )}
        >
          {holding ? "Pouring…" : "Hold to fill"}
        </button>
      </div>

      <p className="mt-2 text-center text-[11px] font-medium text-ink-3">
        Hold to pour gradually · 1s = 1 sip ({SIP_ML} ml) · − to undo
      </p>
    </Card>
  );
}
