"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Card, Badge, ProgressBar, Button } from "@/components/ui";
import { AlertTriangleIcon, BulbIcon, SendIcon } from "@/components/icons";
import { getAllEntries } from "@/lib/api";
import { getStoredSession } from "@/lib/auth";
import { mockUser, MOCK_TODAY } from "@/lib/mock-data";
import {
  answerQuestion,
  greetingMessage,
  suggestedQuestions,
  type AssistantMessage,
} from "@/lib/assistant";
import type { IntakeEntry, Subscription } from "@/lib/types";

export default function AssistantPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [entries, setEntries] = useState<IntakeEntry[]>([]);
  const [messages, setMessages] = useState<AssistantMessage[]>([greetingMessage()]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSubscription(getStoredSession()?.subscription ?? "free");
    getAllEntries().then(setEntries);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    const answer = answerQuestion(trimmed, entries, mockUser.targets, MOCK_TODAY);
    setMessages((m) => [...m, { role: "user", text: trimmed }, answer]);
    setInput("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  if (subscription === null) {
    return <div className="h-40 animate-pulse rounded-card-lg bg-black/[0.05]" />;
  }

  if (subscription !== "premium") {
    return (
      <Card className="p-6 text-center">
        <h1 className="text-[18px] font-extrabold text-ink">
          Nutrition assistant is Premium
        </h1>
        <p className="mx-auto mt-2 max-w-[320px] text-[13px] font-medium text-ink-2">
          Ask questions about your confirmed nutrition history and get cautious,
          educational answers.
        </p>
        <Link
          href="/premium"
          className="mt-4 inline-block rounded-card-sm bg-teal px-5 py-3 text-[14px] font-bold text-white"
        >
          Go Premium
        </Link>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-140px)] max-w-[720px] flex-col overflow-hidden rounded-card-lg bg-card shadow-card md:h-[640px]">
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-navy text-teal">
          <BulbIcon size={17} />
        </span>
        <div>
          <div className="text-[14px] font-bold text-ink">Nutrition assistant</div>
          <div className="text-[11px] font-medium text-ink-3">
            Answers from your confirmed logs
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-5">
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line bg-white px-4 pb-4 pt-3">
        <div className="mb-2.5 flex flex-wrap gap-2">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              className="rounded-full bg-app-bg px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 hover:bg-line"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2.5 rounded-[13px] border border-line-2 px-3.5 py-2.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your nutrition…"
            className="flex-1 bg-transparent text-[13px] font-medium text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-teal text-white"
          >
            <SendIcon size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AssistantMessage }) {
  if (message.role === "user") {
    return (
      <div className="max-w-[80%] self-end rounded-[16px] rounded-br-[4px] bg-navy px-4 py-3 text-[13.5px] font-medium leading-relaxed text-white">
        {message.text}
      </div>
    );
  }

  return (
    <div className="max-w-[86%] self-start rounded-[16px] rounded-bl-[4px] bg-card p-4 shadow-card ring-1 ring-line">
      <p className="text-[13.5px] font-medium leading-relaxed text-ink">
        {message.text}
      </p>

      {message.bars && message.bars.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-2">
          {message.bars.map((bar) => (
            <div key={bar.label}>
              <div className="mb-1 flex justify-between text-[12px] font-semibold text-ink-2">
                <span>{bar.label}</span>
                <span>{bar.percent}%</span>
              </div>
              <ProgressBar value={bar.percent} max={100} height={6} />
            </div>
          ))}
        </div>
      )}

      {message.period && (
        <div className="mt-2.5">
          <Badge tone="teal">{message.period}</Badge>
        </div>
      )}

      {message.note && (
        <div className="mt-2 flex items-start gap-2 text-[11.5px] font-medium leading-relaxed text-ink-2">
          <AlertTriangleIcon size={14} className="mt-px shrink-0 text-amber-d" />
          {message.note}
        </div>
      )}
    </div>
  );
}
