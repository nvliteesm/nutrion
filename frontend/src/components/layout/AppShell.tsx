import { TopNav } from "./TopNav";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";

/**
 * App chrome:
 *  - desktop: left icon rail + content
 *  - mobile: bottom nav (content gets bottom padding)
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full bg-app-bg">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main className="w-full flex-1 px-4 pb-28 pt-5 md:px-6 md:pb-10 md:pt-6 lg:px-8">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
