import { AppShell } from "@/components/shell/AppShell";
import { CLIENT_NAV } from "@/components/shell/nav";
import { signOut } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { requireClient } from "@/lib/auth/session";
import { listNotifications } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const v = await requireClient();
  const unread = listNotifications(v.organization.id).filter((n) => !n.readAt).length;
  return (
    <AppShell
      space="client"
      groups={CLIENT_NAV}
      user={{ name: v.user.fullName, email: v.user.email, roleLabel: ROLE_LABELS[v.role], orgName: v.organization.name }}
      notificationsHref="/client/demandes?tab=notifications"
      unread={unread}
      logout={signOut}
    >
      {children}
    </AppShell>
  );
}
