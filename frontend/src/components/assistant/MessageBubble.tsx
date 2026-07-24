"use client";

import Markdown from "react-markdown";
import { motion } from "motion/react";
import { Badge, ProgressBar } from "@/components/ui";
import { AlertTriangleIcon, BulbIcon } from "@/components/icons";
import type { AssistantMessage } from "@/lib/assistant";
import { EvidenceCards } from "./EvidenceCards";

/** Shared chat bubble used by the full AI chat page and the floating widget. */
export function MessageBubble({
  message,
  compact = false,
  onAsk,
}: {
  message: AssistantMessage;
  compact?: boolean;
  /** Follow-up ask handler for interactive evidence cards. */
  onAsk?: (question: string) => void;
}) {
  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className={`ml-auto max-w-[min(100%,34rem)] rounded-2xl rounded-br-md bg-navy px-4 py-3 font-medium leading-relaxed text-white shadow-card ${
          compact ? "text-[13px]" : "text-[14.5px]"
        }`}
      >
        {message.text}
      </motion.div>
    );
  }

  if (message.loading) {
    return (
      <div className="flex max-w-md items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-card ring-1 ring-line">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-teal">
          <BulbIcon size={16} />
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal [animation-delay:300ms]" />
          <span className="ml-1">Thinking…</span>
        </span>
      </div>
    );
  }

  const hasCards = Boolean(message.cards?.length);
  const markdown = toReadableMarkdown(message.text);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className={`flex w-full flex-col ${compact ? "max-w-full gap-2.5" : "max-w-5xl gap-4"}`}
    >
      {/* Answer text — separate from evidence cards */}
      <div className="flex items-start gap-3">
        {!compact && (
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-teal shadow-card">
            <BulbIcon size={18} />
          </span>
        )}
        <div
          className={`min-w-0 flex-1 rounded-2xl rounded-tl-md bg-card shadow-card-lg ring-1 ring-line ${
            compact ? "px-3.5 py-3 text-[13px]" : "px-5 py-4 text-[15px]"
          }`}
        >
          <div
            className={`assistant-prose font-medium leading-[1.65] text-ink ${
              compact ? "text-[13px]" : "text-[15px]"
            }`}
          >
            <Markdown
              components={{
                p: ({ children }) => (
                  <p className="mb-3 last:mb-0 text-ink">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-ink-2">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-extrabold text-ink">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-ink-2">{children}</em>
                ),
              }}
            >
              {markdown}
            </Markdown>
          </div>

          {message.bars && message.bars.length > 0 && (
            <div className="mt-4 flex flex-col gap-2.5">
              {message.bars.map((bar) => (
                <div key={bar.label}>
                  <div className="mb-1 flex justify-between text-[12.5px] font-semibold text-ink-2">
                    <span>{bar.label}</span>
                    <span>{bar.percent}%</span>
                  </div>
                  <ProgressBar value={bar.percent} max={100} height={7} />
                </div>
              ))}
            </div>
          )}

          {message.period && !hasCards && (
            <div className="mt-3">
              <Badge tone="teal">{message.period}</Badge>
            </div>
          )}

          {message.note && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-t/60 px-3 py-2.5 text-[12.5px] font-medium leading-relaxed text-ink-2">
              <AlertTriangleIcon
                size={15}
                className="mt-0.5 shrink-0 text-amber-d"
              />
              {message.note}
            </div>
          )}
        </div>
      </div>

      {/* Evidence cards live outside the text bubble so they don't blend in */}
      {hasCards && (
        <div className={compact ? "pl-0" : "pl-[52px]"}>
          <EvidenceCards
            cards={message.cards!}
            onAsk={onAsk}
            compact={compact}
          />
        </div>
      )}
    </motion.div>
  );
}

/** Turn long AI prose into readable markdown paragraphs. */
function toReadableMarkdown(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes("\n\n") || trimmed.includes("\n- ")) return trimmed;

  // Split into sentence-sized paragraphs for scanability.
  return trimmed
    .replace(/([.!?])\s+(?=[A-Z0-9"“])/g, "$1\n\n")
    .trim();
}
