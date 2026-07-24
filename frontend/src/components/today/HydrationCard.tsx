"use client";

import { useEffect, useRef, useState } from "react";
import { Card, useToast } from "@/components/ui";
import { deleteIntake, logWaterSip } from "@/lib/api";
import { cn } from "@/lib/cn";
import { WaterWaveDrop } from "./WaterWaveDrop";

const SIP_ML = 30;
const CUP_ML = 250;
/** ms to pour one sip visually — bar fills smoothly at this rate */
const HOLD_MS = 1000;
const DEFAULT_CUPS = 8;
const MIN_COMMIT_ML = 1;
const WATER_TOAST_ID = "water-log";

/**
 * Hold-to-fill water card.
 * Display ml only rises while held (never snaps down).
 * Release freezes at the current value (any ml, not only 30s).
 */
export function HydrationCard({
  ml,
  targetCups,
  onChanged,
  delay = 0,
}: {
  ml: number;
  targetCups: number;
  onChanged?: () => void;
  delay?: number;
}) {
  const { toast } = useToast();
  /** Frozen / committed display total (monotonic except undo). */
  const [displayMl, setDisplayMl] = useState(ml);
  const [holding, setHolding] = useState(false);

  const displayRef = useRef(ml);
  /** ml already successfully logged to the backend (approx). */
  const loggedRef = useRef(ml);
  const sipStack = useRef<{ id: number; ml: number }[]>([]);
  const holdingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const holdStartMl = useRef(0);
  const holdStartAt = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const loggingRef = useRef(false);
  const undoingRef = useRef(false);
  const pendingRefresh = useRef(false);

  const cupsCount = Math.max(1, targetCups || DEFAULT_CUPS);
  const targetMl = cupsCount * CUP_ML;
  const rate = SIP_ML / HOLD_MS; // ml per ms

  useEffect(() => {
    displayRef.current = displayMl;
  }, [displayMl]);

  // Sync from parent: never lower local display unless undoing.
  useEffect(() => {
    if (undoingRef.current) {
      displayRef.current = ml;
      loggedRef.current = ml;
      setDisplayMl(ml);
      undoingRef.current = false;
      return;
    }
    if (ml > displayRef.current && !holdingRef.current) {
      displayRef.current = ml;
      loggedRef.current = Math.max(loggedRef.current, ml);
      setDisplayMl(ml);
    } else if (ml > loggedRef.current) {
      loggedRef.current = ml;
    }
  }, [ml]);

  useEffect(() => {
    return () => {
      holdingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const liveMl = Math.min(targetMl, displayMl);
  const cups = Math.min(cupsCount, Math.floor(liveMl / CUP_ML));
  const overallPct =
    targetMl > 0 ? Math.min(100, (liveMl / targetMl) * 100) : 0;

  function stopAnim() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function currentHoldMl() {
    if (!holdingRef.current) return displayRef.current;
    const elapsed = performance.now() - holdStartAt.current;
    return Math.min(
      targetMl,
      holdStartMl.current + elapsed * rate,
    );
  }

  function startPourAnim() {
    holdStartMl.current = displayRef.current;
    holdStartAt.current = performance.now();
    stopAnim();
    const tick = () => {
      if (!holdingRef.current) return;
      const next = currentHoldMl();
      // Never decrease
      if (next >= displayRef.current) {
        displayRef.current = next;
        setDisplayMl(next);
      }
      if (next >= targetMl) {
        void endHold();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function flushUnlogged(): Promise<void> {
    const due = Math.round(displayRef.current - loggedRef.current);
    if (due < MIN_COMMIT_ML || loggingRef.current) return;

    loggingRef.current = true;
    try {
      const res = await logWaterSip(due);
      sipStack.current.push({ id: res.intake_id, ml: due });
      loggedRef.current += due;
      pendingRefresh.current = true;
      toast({
        id: WATER_TOAST_ID,
        title: "Water logged",
        description: `+${due} ml · ${Math.round(displayRef.current)} ml today`,
        variant: "success",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Backend unreachable";
      toast({
        id: WATER_TOAST_ID,
        title: "Couldn't log water",
        description: msg,
        variant: "error",
      });
    } finally {
      loggingRef.current = false;
    }
  }

  async function endHold() {
    if (!holdingRef.current) return;
    const finalMl = Math.max(displayRef.current, currentHoldMl());
    displayRef.current = Math.min(targetMl, finalMl);
    setDisplayMl(displayRef.current);

    holdingRef.current = false;
    setHolding(false);
    stopAnim();
    pointerIdRef.current = null;

    await flushUnlogged();
    if (pendingRefresh.current) {
      pendingRefresh.current = false;
      onChanged?.();
    }
  }

  async function undoSip() {
    const last = sipStack.current.pop();
    if (last == null) {
      toast({
        id: WATER_TOAST_ID,
        title: "Nothing to undo",
        description: "Hold to pour first",
        variant: "info",
      });
      return;
    }
    undoingRef.current = true;
    const next = Math.max(0, displayRef.current - last.ml);
    displayRef.current = next;
    loggedRef.current = Math.max(0, loggedRef.current - last.ml);
    setDisplayMl(next);
    try {
      await deleteIntake(last.id);
      onChanged?.();
      toast({
        id: WATER_TOAST_ID,
        title: "Water removed",
        description: `−${Math.round(last.ml)} ml · ${Math.round(next)} ml today`,
        variant: "info",
      });
    } catch {
      undoingRef.current = false;
      displayRef.current += last.ml;
      loggedRef.current += last.ml;
      setDisplayMl(displayRef.current);
      sipStack.current.push(last);
      toast({
        id: WATER_TOAST_ID,
        title: "Undo failed",
        variant: "error",
      });
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (displayRef.current >= targetMl) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    holdingRef.current = true;
    setHolding(true);
    startPourAnim();
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
    void endHold();
  }

  return (
    <Card className="flex h-full flex-col p-4 md:p-5" delay={delay}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-ink">Add water</span>
        <span className="text-[11px] font-semibold text-ink-3">
          Goal: {cupsCount} cups
        </span>
      </div>

      <p className="mt-3 text-[13px] font-semibold text-ink-2">
        {Math.round(liveMl)} ml of {targetMl} ml · {cups} of {cupsCount} cups
      </p>

      <div className="mt-3 flex flex-1 items-center justify-center">
        <WaterWaveDrop pct={overallPct} pouring={holding} />
      </div>

      <div className="mt-4 flex gap-1.5">
        {Array.from({ length: cupsCount }).map((_, i) => {
          const start = i * CUP_ML;
          const filledInCup = Math.max(0, Math.min(CUP_ML, liveMl - start));
          const pct = (filledInCup / CUP_ML) * 100;
          return (
            <div
              key={i}
              className="relative h-2.5 flex-1 overflow-hidden rounded-sm bg-line"
            >
              <div
                className="absolute inset-y-0 left-0 bg-blue"
                style={{
                  width: `${pct}%`,
                  transition: holding ? "none" : "width 280ms ease-out",
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          aria-label="Undo last water"
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
          onLostPointerCapture={() => void endHold()}
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
        Hold to pour slowly · release anytime · − to undo
      </p>
    </Card>
  );
}
