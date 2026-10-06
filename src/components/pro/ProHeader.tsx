// Shared header for the contractor workspace. Same nav everywhere so it's
// always one click to inbox, profile, public view, or sign out.
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ExternalLink, Inbox, Link2, LogOut, UserRound, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useContractorAccount } from "@/hooks/useContractorAccount";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export default function ProHeader() {
  const { user, signOut } = useAuth();
  const { account } = useContractorAccount();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [profileSlug, setProfileSlug] = useState<string | null>(null);

  const contractorId = account?.contractor_id;

  useEffect(() => {
    if (!contractorId) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("contractors").select("slug").eq("id", contractorId).maybeSingle();
      if (active && data?.slug) setProfileSlug(data.slug);
    })();
    return () => { active = false; };
  }, [contractorId]);

  const onProfile = pathname.startsWith("/pro/profile");
  const onInbox = pathname.startsWith("/pro/inbox");
  const onLinks = pathname.startsWith("/pro/links");

  const handleSignOut = async () => {
    await signOut();
    navigate("/pro/login", { replace: true });
  };

  const linkClass = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
      active ? "bg-foreground text-background" : "text-foreground/70 hover:bg-muted hover:text-foreground",
    );

  const initial = (account?.company_name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <span className="hidden text-xs text-muted-foreground sm:inline">·</span>
          <span className="hidden truncate text-sm font-medium sm:inline">{account?.company_name ?? "Workspace"}</span>
        </div>

        <nav className="flex items-center gap-1">
          <Link to="/pro/profile" className={linkClass(onProfile)}>
            <UserRound className="h-3.5 w-3.5" /> Profile
          </Link>
          <Link to="/pro/inbox" className={linkClass(onInbox)}>
            <Inbox className="h-3.5 w-3.5" /> Inbox
          </Link>
          <Link to="/pro/links" className={linkClass(onLinks)}>
            <Link2 className="h-3.5 w-3.5" /> Links
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {contractorId && (
            <NotificationBell
              table="contractor_notifications"
              filter={{ column: "contractor_id", value: contractorId }}
              onItemClick={(n) => {
                if (n.outreach_send_id) navigate(`/pro/inbox?open=${n.outreach_send_id}`);
                else navigate("/pro/inbox");
              }}
            />
          )}
          {profileSlug && (
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link to={`/pro/${profileSlug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Public view
              </Link>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Account menu"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-xs hover:bg-muted"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                  {initial}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{user?.email ?? "Signed in"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/pro/profile")}>
                <UserRound className="mr-2 h-4 w-4" /> My profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/pro/inbox")}>
                <Inbox className="mr-2 h-4 w-4" /> Inbox
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/pro/links")}>
                <Link2 className="mr-2 h-4 w-4" /> Brief links
              </DropdownMenuItem>
              {profileSlug && (
                <DropdownMenuItem asChild>
                  <a href={`/pro/${profileSlug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> View public profile
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
