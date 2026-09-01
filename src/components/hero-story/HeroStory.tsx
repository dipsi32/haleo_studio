import { useCallback, useEffect, useRef, useState } from "react";
import { CONTRACTOR_NAME, STEPS, type ScriptMessage } from "./script";
import { ChatBubble } from "./ChatBubble";
import { TypingIndicator } from "./TypingIndicator";
import { InvoiceReveal } from "./InvoiceReveal";
import { ResolutionScreen } from "./ResolutionScreen";
import { track } from "@/lib/analytics";
import "./hero-story.css";

const TYPING_DELAY_MS = 700;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

/**
 * "Text From Mike" — the interactive pain-simulation hero.
 * A simulated contractor text thread that escalates from friendly to
 * quietly predatory, climaxes in a shocking invoice, then turns into a
 * calm resolution that hands off into the real quote-audit flow.
 * See the plan doc for the full beat-by-beat rationale.
 */
export default function HeroStory() {
  const reducedMotion = usePrefersReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const [thread, setThread] = useState<ScriptMessage[]>([]);
  const [revealedInStep, setRevealedInStep] = useState(0);
  const [typing, setTyping] = useState(false);
  const [followUpShown, setFollowUpShown] = useState(false);
  const [invoiceReady, setInvoiceReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const threadEndRef = useRef<HTMLLIElement>(null);

  const step = STEPS[stepIndex];

  // Reveal messages for the current "messages" step one at a time, each
  // preceded by a typing pause — mirrors how the messages actually arrived.
  useEffect(() => {
    if (step.type !== "messages") return;
    if (revealedInStep >= step.messages.length) return;

    setTyping(true);
    const delay = reducedMotion ? 0 : TYPING_DELAY_MS;
    const t = setTimeout(() => {
      setTyping(false);
      setThread((prev) => [...prev, step.messages[revealedInStep]]);
      setRevealedInStep((n) => n + 1);
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, revealedInStep, reducedMotion]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "end" });
  }, [thread, typing, reducedMotion]);

  // Reset the per-step reveal counters in the same update that changes the
  // step index — React batches these, so the reveal effect below never sees
  // a stale (new step, old revealedInStep) pairing that would misalign
  // which message it thinks it's showing next.
  const goToStep = useCallback((index: number) => {
    setStepIndex(index);
    setRevealedInStep(0);
    setFollowUpShown(false);
    setAdvancing(false);
    track("hero_story_beat", { beat: STEPS[index]?.id });
  }, []);

  const handleStart = () => {
    setStarted(true);
    track("hero_story_started");
    goToStep(1);
  };

  const handleAdvanceButton = (label: string) => {
    if (advancing) return;
    setAdvancing(true);
    setThread((prev) => [...prev, { id: `user-${stepIndex}`, sender: "user", text: label }]);
    setTimeout(() => goToStep(stepIndex + 1), reducedMotion ? 0 : 550);
  };

  const handleChoice = (choiceId: string, label: string, followUp: string) => {
    if (advancing) return;
    setAdvancing(true);
    track("hero_story_choice", { beat: step.id, choice: choiceId });
    setThread((prev) => [...prev, { id: `user-${stepIndex}`, sender: "user", text: label }]);
    setTimeout(() => {
      setFollowUpShown(true);
      setThread((prev) => [...prev, { id: `followup-${stepIndex}`, sender: "mike", text: followUp }]);
      setTimeout(() => goToStep(stepIndex + 1), reducedMotion ? 0 : 1400);
    }, reducedMotion ? 0 : 500);
  };

  const handleSkip = () => {
    track("hero_story_skipped", { fromBeat: step.id });
    goToStep(STEPS.length - 1);
  };

  const showSkip = started && step.type !== "resolution";
  const allRevealed = step.type === "messages" && revealedInStep >= step.messages.length && !typing;

  return (
    <section className="hero-story" aria-label="An interactive story about hiring a contractor">
      {step.type === "resolution" && <div className="hero-story__turn-bg" aria-hidden="true" />}

      {showSkip && (
        <button type="button" className="hero-story__skip" onClick={handleSkip}>
          Skip →
        </button>
      )}

      {step.type === "lure" && (
        <div className="hero-story__stage">
          <p className="hero-story__timestamp">{CONTRACTOR_NAME}</p>
          <button
            type="button"
            onClick={handleStart}
            aria-label="Read the message from Mike"
            className="hero-story__lure-trigger"
          >
            <TypingIndicator />
          </button>
          <p className="hero-story__timestamp" style={{ marginTop: "1.5rem", opacity: 0.6 }}>
            You just got a text back.
          </p>
        </div>
      )}

      {step.type === "messages" && (
        <div className="hero-story__stage">
          {step.timestamp && <p className="hero-story__timestamp">{step.timestamp}</p>}
          <ul className="hero-story__thread" aria-live="polite">
            {thread.map((m) => (
              <ChatBubble key={m.id} message={m} reducedMotion={reducedMotion} />
            ))}
            {typing && (
              <li className="hero-story__row hero-story__row--mike">
                <TypingIndicator />
              </li>
            )}
            <li ref={threadEndRef} aria-hidden="true" />
          </ul>

          {allRevealed && step.advance.kind === "button" && !followUpShown && !advancing && (
            <div className="hero-story__replies">
              <button
                type="button"
                className="hero-story__reply"
                onClick={() => handleAdvanceButton(step.advance.kind === "button" ? step.advance.label : "")}
              >
                {step.advance.label}
              </button>
            </div>
          )}

          {allRevealed && step.advance.kind === "choices" && !followUpShown && !advancing && (
            <div className="hero-story__replies">
              {step.advance.choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="hero-story__reply"
                  onClick={() => handleChoice(c.id, c.label, c.followUp)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step.type === "invoice" && (
        <div className="hero-story__stage">
          <InvoiceReveal reducedMotion={reducedMotion} onDone={() => setInvoiceReady(true)} />
          {invoiceReady && (
            <div className="hero-story__replies">
              <button type="button" className="hero-story__reply" onClick={() => goToStep(stepIndex + 1)}>
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {step.type === "resolution" && <ResolutionScreen reducedMotion={reducedMotion} />}
    </section>
  );
}
