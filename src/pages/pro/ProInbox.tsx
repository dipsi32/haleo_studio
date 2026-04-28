// Placeholder for Pass B. Gives contractors something real to land on after onboarding.
import { Link } from "react-router-dom";
import { Inbox, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useContractorAccount } from "@/hooks/useContractorAccount";

const ProInbox = () => {
  const { account } = useContractorAccount();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-sm font-medium">{account?.company_name ?? "Workspace"}</span>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/pro/onboarding">Edit portal</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-light">Your inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Projects from homeowners, with the brief already done.
          </p>
        </div>

        <div className="grid place-items-center rounded-3xl border border-dashed border-border bg-card/40 p-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/60" />
          <h3 className="mt-4 font-display text-xl">No proposals yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            When a homeowner sends you a brief, it'll land here with their photos, scope, and budget signal already in place.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-xs font-medium text-accent">
            <Sparkles className="h-3 w-3" />
            Inbox view ships in Pass B
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProInbox;
