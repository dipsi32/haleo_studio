// One field, two ways in: type it or say it.
// Uses the browser's built-in speech recognition when available; the mic
// simply doesn't appear when it isn't, so nothing ever looks broken.
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
};

// Minimal shape of the Web Speech API we rely on.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

const getRecognition = (): SpeechRecognitionLike | null => {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec: SpeechRecognitionLike = new Ctor();
  rec.lang = "en-US";
  rec.continuous = true;
  rec.interimResults = true;
  return rec;
};

const VoiceTextField = ({ value, onChange, placeholder, rows = 4, autoFocus }: Props) => {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
    );
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  };

  const start = () => {
    const rec = getRecognition();
    if (!rec) return;
    recRef.current = rec;
    baseRef.current = value.trim();
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i += 1) transcript += e.results[i][0].transcript;
      const joined = [baseRef.current, transcript.trim()].filter(Boolean).join(" ");
      onChange(joined);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="rounded-2xl bg-card p-4 pr-14 text-base leading-relaxed"
      />
      {supported && (
        <button
          type="button"
          onClick={listening ? stop : start}
          aria-label={listening ? "Stop recording" : "Speak instead of typing"}
          className={`absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full transition-smooth ${
            listening
              ? "bg-accent text-accent-foreground shadow-lift"
              : "bg-accent-soft text-accent hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {listening
          ? "Listening — say it however you'd say it out loud."
          : supported
            ? "Type it, or tap the mic and just say it."
            : "A sentence is plenty — we'll ask for details later."}
      </p>
    </div>
  );
};

export default VoiceTextField;
