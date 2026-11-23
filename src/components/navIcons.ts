import { Building2, Compass, FileText, HardHat, Home, MessagesSquare, UserCheck } from "lucide-react";
import type { NavId } from "@/lib/nav";

// The same icon for the same door everywhere (the homepage tiles use these too).
export const NAV_ICON: Record<NavId, typeof Compass> = {
  start: Compass,
  names: MessagesSquare,
  one: UserCheck,
  quote: FileText,
  house: Home,
  adu: Building2,
  pro: HardHat,
};

