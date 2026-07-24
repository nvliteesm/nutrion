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
/** Ignore tiny accidental taps when releasing mid-pour. */
const MIN_COMMIT_ML = 2;

/**
 * Hold-to-fill water card.
 * While held, fill rises continuously. On release the level freezes
 * (partial pour is committed so it does not snap back).
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
  const [committedMl, setCommittedMl] = useState(ml);
  /** Preview ml for the in-progress sip (0 → SIP_ML). */
  const [pourMl, setPourMl] = useState(0);
  const [holding, setHolding] = useState(false);

  const sipStack = useRef<{ id: number; ml: number }[]>([]);
  const holdingRef = useRef(false);
  const sipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const pourAnchor = useRef(0);
  const pourMlRef = useRef(0);
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
  // While holding, show committed + live pour so the drop fills continuously.
  const liveMl = Math.min(
    targetMl,
    committedMl + (holding ? pourMl : 0),
  );
  const cups = Math.min(cupsCount, Math.floor(liveMl / CUP_ML));
  const overallPct =
    targetMl > 0 ? Math.min(100, (liveMl / targetMl) * 100) : 0;

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

  function clearHoldTimers() {
    holdingRef.current = false;
    setHolding(false);
    if (sipTimer.current) {
      clearTimeout(sipTimer.current);
      sipTimer.current = null;
    }
    stopAnim();
    pourMlRef.current = 0;
    setPourMl(0);
    pointerIdRef.current = null;
  }

  function startPourAnim() {
    pourAnchor.current = performance.now();
    pourMlRef.current = 0;
    setPourMl(0);
    stopAnim();
    const tick = () => {
      if (!holdingRef.current) return;
      const elapsed = performance.now() - pourAnchor.current;
      const room = Math.max(0, targetMl - committedRef.current);
      const partial = Math.min(SIP_ML, room, (elapsed / HOLD_MS) * SIP_ML);
      pourMlRef.current = partial;
      setPourMl(partial);
      if (room <= 0) {
        void endHold(true);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function commitMl(amount: number): Promise<boolean> {
    const mlToAdd = Math.round(amount);
    if (mlToAdd < MIN_COMMIT_ML) return true;
    if (committedRef.current >= targetMl) return true;

    // Wait out any in-flight log so release doesn't drop a partial pour.
    const started = performance.now();
    while (sipInFlight.current && performance.now() - started < 5000) {
      await new Promise((r) => setTimeout(r, 25));
    }
    if (sipInFlight.current) return false;

    sipInFlight.current = true;
    const next = Math.min(targetMl, committedRef.current + mlToAdd);
    const applied = next - committedRef.current;
    committedRef.current = next;
    setCommittedMl(next);
    pourMlRef.current = 0;
    setPourMl(0);

    try {
      const res = await logWaterSip(applied);
      sipStack.current.push({ id: res.intake_id, ml: applied });
      pendingRefresh.current = true;
      return true;
    } catch (err) {
      const rolled = Math.max(0, committedRef.current - applied);
      committedRef.current = rolled;
      setCommittedMl(rolled);
      const msg = err instanceof Error ? err.message : "Backend unreachable";
      toast({
        title: "Couldn't log water",
        description: msg,
        variant: "error",
      });
      return false;
    } finally {
      sipInFlight.current = false;
    }
  }

  function scheduleNextSip() {
    if (sipTimer.current) clearTimeout(sipTimer.current);
    sipTimer.current = setTimeout(() => {
      if (!holdingRef.current) return;
      void commitMl(SIP_ML).then((ok) => {
        if (!holdingRef.current) return;
        if (!ok || committedRef.current >= targetMl) {
          clearHoldTimers();
          flushRefresh();
          return;
        }
        startPourAnim();
        scheduleNextSip();
      });
    }, HOLD_MS);
  }

  async function endHold(fromTarget = false) {
    if (!holdingRef.current && !fromTarget) return;
    const partial = pourMlRef.current;
    clearHoldTimers();
    if (partial >= MIN_COMMIT_ML) {
      await commitMl(partial);
    }
    flushRefresh();
  }

  async function undoSip() {
    const last = sipStack.current.pop();
    if (last == null) {
      toast({
        title: "Nothing to undo",
        description: "Hold to pour first",
        variant: "info",
      });
      return;
    }
    undoingRef.current = true;
    const next = Math.max(0, committedRef.current - last.ml);
    committedRef.current = next;
    setCommittedMl(next);
    pourMlRef.current = 0;
    setPourMl(0);
    try {
      await deleteIntake(last.id);
      onChanged?.();
      toast({
        title: "Sip undone",
        description: `−${Math.round(last.ml)} ml`,
        variant: "info",
      });
    } catch {
      undoingRef.current = false;
      const restored = committedRef.current + last.ml;
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

      <div className="mt-4">
        <WaterWaveDrop pct={overallPct} pouring={holding} />
      </div>

      <div className="mt-4 flex gap-1.5">
        {Array.from({ length: cupsCount }).map((_, i) => {
          const start = i * CUP_ML;
          const filledInCup = Math.max(0, Math.min(CUP_ML, liveMl - start));
          const pct = (filledInCup / CUP_ML) * 100;
          const isActiveCup =
            holding &&
            liveMl < targetMl &&
            liveMl >= start &&
            liveMl < start + CUP_ML;
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
        Hold to pour · release to keep · − to undo
      </p>
    </Card>
  );
}
