// Every way into Haleo, named once.
//
// Card-sorted by what the homeowner is holding when they arrive, which is
// the same question the homepage asks ("Where are you in your search?"):
//
//   Find a contractor   → no one yet / names from neighbors / one name
//   Check a quote       → a quote in hand
//   Your home           → curious about the house itself
//   For contractors
//
// The top nav, the mobile menu, the homepage tiles and each page's eyebrow
// all read their words from here, so a name means the same thing everywhere.
// Tested in nav.test.ts.
import type { GatewayPath } from "@/lib/homeGateway";

export type NavId = "start" | "names" | "one" | "quote" | "house" | "adu" | "pro";

export type NavItem = {
  id: NavId;
  /** The name used everywhere: menu, page eyebrow, tile tag. */
  label: string;
  /** One line on what you get, in the homeowner's words. */
  hint: string;
  /** Where space is tight (the homepage demo's tabs). */
  short: string;
  href: string;
  /** The homepage tile this is the same door as, if any. */
  gateway?: GatewayPath;
};

export type NavGroup = { id: "hire" | "quote" | "home" | "pro"; label: string; items: NavItem[] };

export const NAV: Record<NavId, NavItem> = {
  start: { id: "start", short: "New project", label: "Start a project", hint: "Tell us the job. See who has built it nearby.", href: "/brief", gateway: "scratch" },
  names: { id: "names", short: "Your names", label: "Check names you've got", hint: "From Nextdoor, a group chat or a friend", href: "/shortlist", gateway: "thread" },
  one: { id: "one", short: "One contractor", label: "Check one contractor", hint: "Their city record, read against your job", href: "/shortlist?one=1", gateway: "one" },
  quote: { id: "quote", short: "A quote", label: "Check a quote", hint: "Line by line, before you sign", href: "/roast", gateway: "quote" },
  house: { id: "house", short: "Your house", label: "Look up your house", hint: "Permits, sign-offs and hazard zones", href: "/house" },
  adu: { id: "adu", short: "ADU check", label: "ADU check", hint: "Can you build one on your lot?", href: "/adu" },
  pro: { id: "pro", short: "Contractors", label: "For contractors", hint: "Know the job before you make the trip", href: "/pro" },
};

export const NAV_GROUPS: NavGroup[] = [
  { id: "hire", label: "Find a contractor", items: [NAV.start, NAV.names, NAV.one] },
  { id: "quote", label: "Check a quote", items: [NAV.quote] },
  { id: "home", label: "Your home", items: [NAV.house, NAV.adu] },
  { id: "pro", label: "For contractors", items: [NAV.pro] },
];

/** The menu item that is the same door as a homepage tile. */
export const navForGateway = (path: GatewayPath): NavItem | undefined => Object.values(NAV).find((n) => n.gateway === path);
