"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Skeleton, useToast } from "@/components/ui";
import { BulbIcon, SendIcon } from "@/components/icons";
import { suggestedQuestions } from "@/lib/assistant";
import { useChat } from "./ChatProvider";
import { MessageBubble } from "./MessageBubble";
import { VoiceInputButton } from "./VoiceInputButton";

/**
 * Full-page AI chat. Wide layout, readable answer text (react-markdown),
 * and evidence cards rendered outside the bubble so they don't blend in.
 */
export function ChatWindow() {
  const { messages, ask, reset, subscription } = useChat();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
    setInput("");
  }

  if (subscription === null) {
    return <Skeleton className="h-full min-h-[240px] rounded-none" />;
  }

  if (subscription !== "premium") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-teal shadow-card">
          <BulbIcon size={24} />
        </span>
        <h1 className="text-[20px] font-extrabold text-ink">AI Chat is Premium</h1>
        <p className="max-w-[360px] text-[14px] font-medium leading-relaxed text-ink-2">
          Ask questions about your confirmed nutrition logs and get cautious,
          educational answers grounded in your data.
        </p>
        <Link
          href="/premium"
          className="mt-1 rounded-card-sm bg-teal px-6 py-3 text-[14px] font-bold text-white"
        >
          Go Premium
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-app-bg">
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-card px-4 py-3.5 md:px-6 lg:px-8">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-teal shadow-card">
          <BulbIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-extrabold tracking-tight text-ink">
            AI Chat
          </div>
          <div className="text-[12px] font-medium text-ink-3">
            Answers from your confirmed logs · educational only
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-line bg-app-bg px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:bg-line/60 hover:text-ink"
        >
          Clear
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} onAsk={ask} />
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-card px-4 py-3.5 md:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className="rounded-full border border-line bg-app-bg px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:border-teal/30 hover:bg-teal-t hover:text-teal-d"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 rounded-2xl border border-line-2 bg-app-bg px-3 py-2.5 shadow-card focus-within:border-teal/40 focus-within:ring-2 focus-within:ring-teal/15 sm:gap-3 sm:px-4 sm:py-3"
          >
            <VoiceInputButton
              onTranscript={(text) =>
                setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
              }
              onError={(message) => toast({ title: message, variant: "error" })}
            />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your nutrition…"
              className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-3 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!input.trim()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal text-white shadow-card disabled:opacity-40"
            >
              <SendIcon size={17} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
