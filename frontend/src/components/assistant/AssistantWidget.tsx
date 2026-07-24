"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BulbIcon, ChatIcon, ExpandIcon, SendIcon, XIcon } from "@/components/icons";
import { useToast } from "@/components/ui";
import { suggestedQuestions } from "@/lib/assistant";
import { useChat } from "./ChatProvider";
import { MessageBubble } from "./MessageBubble";
import { VoiceInputButton } from "./VoiceInputButton";

/**
 * Floating chat launcher (bottom-right) with a compact popup.
 * Expanding routes to the full AI Chat page; conversation state is shared
 * via ChatProvider so it carries over seamlessly.
 */
export function AssistantWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { messages, ask, subscription, widgetOpen, setWidgetOpen } = useChat();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (widgetOpen) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, widgetOpen]);

  // Don't show the launcher on the full AI chat page.
  if (pathname === "/history" || pathname === "/assistant") return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
    setInput("");
  }

  function expand() {
    setWidgetOpen(false);
    router.push("/history");
  }

  const isPremium = subscription === "premium";

  return (
    <>
      {/* Launcher button */}
      {!widgetOpen && (
        <button
          onClick={() => setWidgetOpen(true)}
          aria-label="Open nutrition assistant"
          className="fixed bottom-24 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-navy text-teal shadow-card-lg transition-transform hover:scale-105 md:bottom-6 md:right-6"
        >
          <ChatIcon size={24} />
        </button>
      )}

      {/* Mini chat panel */}
      {widgetOpen && (
        <div className="fixed bottom-24 right-4 z-40 flex h-[460px] w-[calc(100vw-2rem)] max-w-[360px] animate-scale-in flex-col overflow-hidden rounded-card-lg bg-card shadow-card-lg md:bottom-6 md:right-6">
          <div className="flex items-center gap-2.5 bg-navy px-4 py-3 text-white">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-white/[0.14] text-teal">
              <BulbIcon size={16} />
            </span>
            <div className="flex-1">
              <div className="text-[13.5px] font-bold">Nutrition assistant</div>
              <div className="text-[10.5px] font-medium text-white/60">
                From your confirmed logs
              </div>
            </div>
            <button
              onClick={expand}
              aria-label="Expand to full chat"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] text-white/70 hover:bg-white/10 hover:text-white"
            >
              <ExpandIcon size={16} />
            </button>
            <button
              onClick={() => setWidgetOpen(false)}
              aria-label="Close chat"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] text-white/70 hover:bg-white/10 hover:text-white"
            >
              <XIcon size={18} />
            </button>
          </div>

          {isPremium ? (
            <>
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-app-bg px-3.5 py-3.5">
                {messages.map((m, i) => (
                  <MessageBubble key={i} message={m} compact onAsk={ask} />
                ))}
                <div ref={endRef} />
              </div>

              <div className="border-t border-line bg-card px-3 pb-3 pt-2.5">
                <div className="mb-2 flex gap-1.5 overflow-x-auto">
                  {suggestedQuestions.slice(0, 2).map((q) => (
                    <button
                      key={q}
                      onClick={() => ask(q)}
                      className="whitespace-nowrap rounded-full bg-app-bg px-2.5 py-1 text-[10.5px] font-semibold text-ink-2 hover:bg-line"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={handleSubmit}
                  className="flex items-center gap-1.5 rounded-[12px] border border-line-2 px-2.5 py-2"
                >
                  <VoiceInputButton
                    compact
                    onTranscript={(text) =>
                      setInput((prev) =>
                        prev.trim() ? `${prev.trim()} ${text}` : text,
                      )
                    }
                    onError={(message) =>
                      toast({ title: message, variant: "error" })
                    }
                  />
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your nutrition…"
                    className="min-w-0 flex-1 bg-transparent text-[12.5px] font-medium text-ink placeholder:text-ink-3 focus:outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Send"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] bg-teal text-white"
                  >
                    <SendIcon size={14} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-app-bg px-6 text-center">
              <p className="text-[13px] font-semibold text-ink">
                The AI assistant is a Premium feature.
              </p>
              <p className="text-[12px] font-medium text-ink-2">
                Ask questions about your confirmed nutrition history.
              </p>
              <Link
                href="/premium"
                onClick={() => setWidgetOpen(false)}
                className="rounded-card-sm bg-teal px-4 py-2.5 text-[13px] font-bold text-white"
              >
                Go Premium
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
