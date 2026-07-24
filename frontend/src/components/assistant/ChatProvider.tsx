"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getStoredSession } from "@/lib/auth";
import {
  askBackend,
  greetingMessage,
  loadingMessage,
  type AssistantMessage,
} from "@/lib/assistant";
import type { Subscription } from "@/lib/types";

interface ChatContextValue {
  messages: AssistantMessage[];
  ask: (question: string) => void;
  reset: () => void;
  subscription: Subscription | null;
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
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [widgetOpen, setWidgetOpen] = useState(false);

  useEffect(() => {
    setMessages(loadMessages());
    setSubscription(getStoredSession()?.subscription ?? "free");
  }, []);

  // Persist conversation so it survives navigation between mini and full view.
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Don't persist loading messages.
      const toSave = messages.filter((m) => !m.loading);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    }
  }, [messages]);

  const ask = useCallback((question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    // Add user message + a loading placeholder.
    setMessages((m) => [...m, { role: "user", text: trimmed }, loadingMessage()]);

    const userId = getStoredSession()?.userId ?? "default";
    askBackend(trimmed, userId).then((answer) => {
      setMessages((m) => {
        const withoutLoading = m.filter((msg) => !msg.loading);
        return [...withoutLoading, answer];
      });
    });
  }, []);

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
