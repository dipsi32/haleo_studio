import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { UserRound, LogIn, LogOut, Shield, MessageSquare, ChevronDown, Menu, X, Flame, Hammer, HardHat, Building2 } from "lucide-react";
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

const SiteHeader = () => {
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

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="container flex h-20 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link to="/roast" className="transition-smooth hover:text-foreground">Get it roasted</Link>
          <Link to="/" className="transition-smooth hover:text-foreground">Find your contractor</Link>
          <Link to="/adu" className="transition-smooth hover:text-foreground">ADU check</Link>
          <Link to="/pro" className="transition-smooth hover:text-foreground">For contractors</Link>
          {isAdmin && (
            <Link to="/admin" className="transition-smooth hover:text-foreground">Admin</Link>
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
              <p className="text-xs text-muted-foreground">Where contractors earn their keep.</p>
            </SheetHeader>
            <nav className="flex flex-col px-3 py-4 text-base">
              <button onClick={() => go("/")} className="group flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-smooth hover:bg-secondary">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Hammer className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block font-medium">Find your contractor</span>
                  <span className="block text-xs text-muted-foreground">Get matched in minutes</span>
                </span>
              </button>
              <button onClick={() => go("/roast")} className="group flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-smooth hover:bg-secondary">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Flame className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block font-medium">Get it roasted</span>
                  <span className="block text-xs text-muted-foreground">Free proposal audit</span>
                </span>
              </button>
              <button onClick={() => go("/adu")} className="group flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-smooth hover:bg-secondary">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block font-medium">ADU feasibility check</span>
                  <span className="block text-xs text-muted-foreground">Can you build an ADU here?</span>
                </span>
              </button>
              <button onClick={() => go("/pro")} className="group flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-smooth hover:bg-secondary">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <HardHat className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block font-medium">For contractors</span>
                  <span className="block text-xs text-muted-foreground">Sign in or join</span>
                </span>
              </button>

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
