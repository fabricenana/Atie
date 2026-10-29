import {
  BookOpen, Briefcase, Building2, CreditCard, Gauge, Inbox, Layers, LayoutDashboard, LifeBuoy, MessagesSquare, Plug, Radio, Receipt, Settings, UserRound,
} from "lucide-react";
import type { IconName } from "./nav";

export const NAV_ICONS: Record<IconName, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  building: Building2,
  "user-round": UserRound,
  book: BookOpen,
  messages: MessagesSquare,
  radio: Radio,
  layers: Layers,
  receipt: Receipt,
  plug: Plug,
  settings: Settings,
  gauge: Gauge,
  "credit-card": CreditCard,
  briefcase: Briefcase,
  "life-buoy": LifeBuoy,
  inbox: Inbox,
};
