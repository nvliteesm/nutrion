"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  AlertTriangleIcon,
  CheckIcon,
  InfoIcon,
  XIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";

type ToastVariant = "success" | "error" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyle: Record<ToastVariant, { icon: React.ReactNode; ring: string }> = {
  success: {
    icon: <CheckIcon size={15} className="text-teal-d" />,
    ring: "ring-teal/30",
  },
  error: {
    icon: <AlertTriangleIcon size={15} className="text-red-d" />,
    ring: "ring-red/30",
  },
  info: {
    icon: <InfoIcon size={15} className="text-blue-d" />,
    ring: "ring-blue/30",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = ++counter.current;
      const item: ToastItem = { id, variant: "info", duration: 4000, ...opts };
      setToasts((list) => [...list, item]);
      if (item.duration && item.duration > 0) {
        setTimeout(() => dismiss(id), item.duration);
      }
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => {
          const style = variantStyle[t.variant ?? "info"];
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-card bg-card px-4 py-3 shadow-card-lg ring-1",
                "animate-slide-up",
                style.ring,
              )}
              role="status"
            >
              <span className="mt-0.5 shrink-0">{style.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-ink">{t.title}</div>
                {t.description && (
                  <div className="mt-0.5 text-[12px] font-medium text-ink-2">
                    {t.description}
                  </div>
                )}
              </div>
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="shrink-0 rounded-md px-2 py-1 text-[12px] font-bold text-teal-d hover:bg-app-bg"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 text-ink-3 hover:text-ink"
              >
                <XIcon size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
