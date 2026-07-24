import { TopNav } from "./TopNav";
import { BottomNav } from "./BottomNav";

/**
 * App chrome shared by every signed-in page:
 *  - desktop: sticky top navbar
 *  - mobile: fixed bottom navbar (content gets bottom padding to clear it)
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-app-bg">
      <TopNav />
      <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-7">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
