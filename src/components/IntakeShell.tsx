import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import Logo from "./Logo";

type Props = {
  step: number;
  total: number;
  onBack?: () => void;
  exitTo?: string;
  children: React.ReactNode;
};

const IntakeShell = ({ step, total, onBack, exitTo = "/", children }: Props) => {
  const progress = Math.max(0, Math.min(100, (step / total) * 100));

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && step > 1 ? (
              <button
                onClick={onBack}
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card transition-smooth hover:bg-secondary"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <Logo />
            )}
          </div>
          <Link
            to={exitTo}
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card transition-smooth hover:bg-secondary"
            aria-label="Exit"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 py-10 md:items-center md:py-16">
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
