// If any screen throws while rendering, React unmounts the whole app and
// leaves a white page. This catches it: a calm message, their progress
// (kept in this browser) still there, one tap to recover, and the error
// reported so we can find the exact screen. Resets when they navigate.
import { Component, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { track } from "@/lib/analytics";

type State = { error: Error | null };

class Boundary extends Component<{ children: ReactNode; resetKey: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    track("app_crashed", {
      message: error.message.slice(0, 300),
      path: window.location.pathname,
      component: (info.componentStack ?? "").trim().split("\n")[0]?.trim().slice(0, 200) ?? "",
    });
    // eslint-disable-next-line no-console
    console.error("Haleo screen error", error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <div className="max-w-md text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Haleo</p>
          <h1 className="mt-4 font-display text-[1.9rem] font-light leading-tight">
            Something went wrong <span className="italic">on our side.</span>
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
            Nothing you entered is lost: it's saved in this browser. Reloading usually fixes it, and we've been told so we can
            fix it for good.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-12 items-center rounded-full bg-foreground px-7 text-[15px] font-medium text-background transition-smooth hover:opacity-90"
            >
              Reload this page
            </button>
            <a href="/" className="inline-flex h-12 items-center rounded-full border border-border px-7 text-[15px] font-medium transition-smooth hover:bg-secondary">
              Go to the homepage
            </a>
          </div>
        </div>
      </main>
    );
  }
}

/** Wrap the routes: a crash shows a recovery screen, and moving to another page clears it. */
export default function ErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <Boundary resetKey={location.pathname}>{children}</Boundary>;
}
