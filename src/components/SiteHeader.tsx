import { Link, useNavigate } from "react-router-dom";
import { UserRound, LogIn, LogOut, Shield, MessageSquare, ChevronDown } from "lucide-react";
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

const SiteHeader = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="container flex h-20 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#how" className="transition-smooth hover:text-foreground">How it works</a>
          <a href="#pricing" className="transition-smooth hover:text-foreground">Pricing</a>
          <Link to="/brief" className="transition-smooth hover:text-foreground">For homeowners</Link>
          <Link to="/audit" className="transition-smooth hover:text-foreground">For contractors</Link>
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
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-soft transition-smooth hover:bg-secondary"
          >
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
        )}
      </div>
    </header>
  );
};

export default SiteHeader;
