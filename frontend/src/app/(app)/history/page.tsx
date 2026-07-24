"use client";

import { ChatWindow } from "@/components/assistant/ChatWindow";

/**
 * Primary AI chat route (nav label: AI Chat).
 * Full-bleed wide chat — calendar lives on Today; medical labs on /medical.
 */
export default function AiChatPage() {
  return (
    <div className="-mx-4 -mb-28 -mt-5 flex h-[calc(100dvh-58px-4.75rem)] flex-col overflow-hidden border-t border-line md:-mx-6 md:-mb-10 md:-mt-6 md:h-[calc(100dvh)] lg:-mx-8 xl:-mx-10">
      <ChatWindow />
    </div>
  );
}
