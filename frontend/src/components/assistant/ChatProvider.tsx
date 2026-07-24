"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getAllEntries } from "@/lib/api";
import { getStoredSession } from "@/lib/auth";
import { getToday } from "@/lib/date";
import { DEFAULT_TARGETS } from "@/lib/types";
import {
  answerQuestion,
  greetingMessage,
  type AssistantMessage,
} from "@/lib/assistant";
import type { IntakeEntry, Subscription } from "@/lib/types";

interface ChatContextValue {
  messages: AssistantMessage[];
  ask: (question: string) => void;
  reset: () => void;
  subscription: Subscription | null;
  /** Mini widget open/closed state. */
  widgetOpen: boolean;
  setWidgetOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const STORAGE_KEY = "nutrion.chat";

function loadMessages(): AssistantMessage[] {
  if (typeof window === "undefined") return [greetingMessage()];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AssistantMessage[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [greetingMessage()];
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([greetingMessage()]);
  const [entries, setEntries] = useState<IntakeEntry[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [widgetOpen, setWidgetOpen] = useState(false);

  useEffect(() => {
    setMessages(loadMessages());
    setSubscription(getStoredSession()?.subscription ?? "free");
    getAllEntries().then(setEntries);
  }, []);

  // Persist conversation so it survives navigation between mini and full view.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  const ask = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      const answer = answerQuestion(trimmed, entries, DEFAULT_TARGETS, getToday());
      setMessages((m) => [...m, { role: "user", text: trimmed }, answer]);
    },
    [entries],
  );

  const reset = useCallback(() => {
    setMessages([greetingMessage()]);
  }, []);

  return (
    <ChatContext.Provider
      value={{ messages, ask, reset, subscription, widgetOpen, setWidgetOpen }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
