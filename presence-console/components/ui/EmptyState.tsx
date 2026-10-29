import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({ title, description, icon, action }: { title: string; description?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-surface-3 text-faint [&_svg]:size-5">{icon ?? <Inbox />}</div>
      <p className="font-head text-[15px] font-semibold">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-[13.5px] text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
