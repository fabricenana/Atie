import { AppShell } from "@/components/shell/AppShell";
import { ADMIN_NAV } from "@/components/shell/nav";
import { signOut } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { listNotifications } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const v = await requireAdmin();
  const unread = listNotifications(null).filter((n) => !n.readAt).length;
  return (
    <AppShell
      space="admin"
      groups={ADMIN_NAV}
      user={{ name: v.user.fullName, email: v.user.email, roleLabel: ROLE_LABELS[v.role] }}
      notificationsHref="/admin/parametres?section=notifications"
      unread={unread}
      logout={signOut}
    >
      {children}
    </AppShell>
  );
}
