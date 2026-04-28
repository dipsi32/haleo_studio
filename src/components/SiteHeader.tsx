import { Link } from "react-router-dom";
import { UserRound, LogIn } from "lucide-react";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const SiteHeader = () => {
  const { user, loading } = useAuth();
  const { isAdmin } = useIsAdmin();

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
            <NotificationBell table="homeowner_notifications" filter={{ column: "user_id", value: user.id }} />
            <Link
              to="/account"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-soft transition-smooth hover:bg-secondary"
            >
              <UserRound className="h-4 w-4" /> My account
            </Link>
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
