import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ChatProvider } from "@/components/assistant/ChatProvider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ChatProvider>
        <AppShell>{children}</AppShell>
      </ChatProvider>
    </AuthGuard>
  );
}
