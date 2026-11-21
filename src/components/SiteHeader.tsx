import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { UserRound, LogIn, LogOut, Shield, MessageSquare, ChevronDown, Menu } from "lucide-react";
import { NAV_ICON } from "@/components/navIcons";
import { NAV_GROUPS, type NavId, type NavItem } from "@/lib/nav";
import { track } from "@/lib/analytics";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const isHere = (item: NavItem, path: string, search: string) => {
  const [p, q] = item.href.split("?");
  if (p !== path) return false;
  return q ? search.includes(q) : !(p === "/shortlist" && search.includes("one=1"));
};

/** A door, as a card: icon, name, what you get. Used in the dropdowns and the mobile sheet. */
const DoorCard = ({ item, onGo, here }: { item: NavItem; onGo: (item: NavItem) => void; here: boolean }) => {
  const Icon = NAV_ICON[item.id];
  return (
    <button
      type="button"
      onClick={() => onGo(item)}
      className={`group flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-smooth hover:bg-secondary ${here ? "bg-secondary" : ""}`}
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14.5px] font-medium text-foreground">{item.label}</span>
        <span className="block text-[12.5px] leading-snug text-muted-foreground">{item.hint}</span>
      </span>
    </button>
  );
};

/** floating: overlaid on the page (default). The homepage passes false to keep it in the flow. */
const SiteHeader = ({ floating = true }: { floating?: boolean }) => {
  const location = useLocation();
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setMobileOpen(false);
    navigate("/", { replace: true });
  };

  const go = (path: string) => {
    setMobileOpen(false);
    navigate(path);
  };
  const goItem = (item: NavItem) => {
    track("nav_clicked", { item: item.id, from: location.pathname });
    go(item.href);
  };
  const here = (item: NavItem) => isHere(item, location.pathname, location.search);

  return (
    <header className={floating ? "absolute inset-x-0 top-0 z-30" : "relative z-30"}>
      <div className="container flex h-20 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-1 text-[14.5px] text-muted-foreground md:flex" aria-label="Main">
          {NAV_GROUPS.map((g) =>
            g.items.length === 1 ? (
              <button
                key={g.id}
                type="button"
                onClick={() => goItem(g.items[0])}
                className={`rounded-full px-3.5 py-2 transition-smooth hover:bg-secondary hover:text-foreground ${here(g.items[0]) ? "text-foreground" : ""}`}
              >
                {g.label}
              </button>
            ) : (
              <DropdownMenu key={g.id}>
                <DropdownMenuTrigger
                  className={`inline-flex items-center gap-1 rounded-full px-3.5 py-2 outline-none transition-smooth hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground ${
                    g.items.some(here) ? "text-foreground" : ""
                  }`}
                >
                  {g.label} <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={8} className="w-80 rounded-3xl p-2">
                  {g.items.map((item) => (
                    <DoorCard key={item.id} item={item} onGo={goItem} here={here(item)} />
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          )}
          {isAdmin && (
            <Link to="/admin" className="rounded-full px-3.5 py-2 transition-smooth hover:bg-secondary hover:text-foreground">Admin</Link>
          )}
        </nav>
        {loading ? (
          <span className="h-9 w-28 rounded-full bg-secondary/60" aria-hidden />
        ) : user ? (
          <div className="flex items-center gap-2">
            <NotificationBell
              table="homeowner_notifications"
              filter={{ column: "user_id", value: user.id }}
              onItemClick={(n) => navigate(n.outreach_send_id ? `/account?convo=${n.outreach_send_id}` : "/account")}
            />
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-soft transition-smooth hover:bg-secondary">
                <UserRound className="h-4 w-4" />
                <span className="hidden max-w-[140px] truncate sm:inline">
                  {user.user_metadata?.full_name?.split(" ")[0] ?? "Account"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/account")}>
                  <UserRound className="h-4 w-4" /> My projects
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/account#messages")}>
                  <MessageSquare className="h-4 w-4" /> Messages
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Shield className="h-4 w-4" /> Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Link
            to="/login"
            className="hidden md:inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-soft transition-smooth hover:bg-secondary"
          >
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
        )}

        {/* Mobile hamburger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              className="ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-soft transition-smooth hover:bg-secondary md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[88%] max-w-sm p-0">
            <SheetHeader className="border-b border-border px-6 py-5 text-left">
              <SheetTitle className="font-display text-2xl tracking-tight">Haleo</SheetTitle>
              <p className="text-xs text-muted-foreground">Hire on facts, not hope.</p>
            </SheetHeader>
            <nav className="flex flex-col px-3 py-4 text-base" aria-label="Main">
              {NAV_GROUPS.map((g) => (
                <div key={g.id} className="mb-2">
                  {g.items.length > 1 && (
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.label}</p>
                  )}
                  {g.items.map((item) => (
                    <DoorCard key={item.id} item={item} onGo={goItem} here={here(item)} />
                  ))}
                </div>
              ))}

              {user && (
                <>
                  <div className="my-2 h-px bg-border" />
                  <button onClick={() => go("/account")} className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-smooth hover:bg-secondary">
                    <UserRound className="h-4 w-4" /> My projects
                  </button>
                  <button onClick={() => go("/account#messages")} className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-smooth hover:bg-secondary">
                    <MessageSquare className="h-4 w-4" /> Messages
                  </button>
                  {isAdmin && (
                    <button onClick={() => go("/admin")} className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-smooth hover:bg-secondary">
                      <Shield className="h-4 w-4" /> Admin
                    </button>
                  )}
                </>
              )}

              <div className="my-2 h-px bg-border" />
              {user ? (
                <button onClick={handleSignOut} className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-destructive transition-smooth hover:bg-destructive/10">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              ) : (
                <button onClick={() => go("/login")} className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-smooth hover:bg-secondary">
                  <LogIn className="h-4 w-4" /> Sign in
                </button>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default SiteHeader;
