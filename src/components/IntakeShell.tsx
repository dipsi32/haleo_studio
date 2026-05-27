import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, X, LogOut, UserRound, Check, ChevronDown, LogIn } from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  step: number;
  total: number;
  onBack?: () => void;
  exitTo?: string;
  children: React.ReactNode;
};

const IntakeShell = ({ step, onBack, exitTo = "/account", children }: Props) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleBack = () => {
    if (step > 1 && onBack) onBack();
    else navigate(user ? "/account" : "/");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 transition-smooth hover:border-accent/40 hover:text-foreground"
              aria-label={step > 1 ? "Go back" : "Back to my projects"}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {step > 1 ? "Back" : user ? "My projects" : "Home"}
            </button>
            <span className="hidden sm:inline-flex"><Logo /></span>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <span
                className="hidden items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1 text-[11px] font-medium text-sage sm:inline-flex"
                title="Your progress saves automatically. Come back anytime."
              >
                <Check className="h-3 w-3" /> Saved
              </span>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-smooth hover:bg-secondary">
                  <UserRound className="h-3.5 w-3.5" />
                  <span className="hidden max-w-[120px] truncate sm:inline">
                    {user.user_metadata?.full_name?.split(" ")[0] ?? "Account"}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/account")}>
                    <UserRound className="h-4 w-4" /> My projects
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"
              >
                <LogIn className="h-3.5 w-3.5" /> Sign in
              </Link>
            )}

            <Link
              to={exitTo}
              className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card transition-smooth hover:bg-secondary"
              aria-label="Exit"
              title="Exit — your progress is saved"
            >
              <X className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 py-7 md:py-10 md:items-center md:py-16">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-3xl"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};

export default IntakeShell;
