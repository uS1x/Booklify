import { requireUser } from "@/lib/auth";
import { unreadNotificationCount } from "@/lib/notifications";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await unreadNotificationCount(user.id);

  return (
    <div className="min-h-dvh lg:pl-64">
      <Sidebar user={user} unread={unread} />
      <TopBar user={user} unread={unread} />
      <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-16">{children}</main>
      <BottomNav unread={unread} />
    </div>
  );
}
