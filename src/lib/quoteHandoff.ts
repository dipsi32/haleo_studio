// Small in-memory handoff so the homepage can pass a quote (file or text)
// into the audit flow without serialising it through router state.

let pendingFile: File | null = null;
let pendingText: string | null = null;

export function setPendingQuoteFile(file: File) {
  pendingFile = file;
  pendingText = null;
}

export function setPendingQuoteText(text: string) {
  pendingText = text;
  pendingFile = null;
}

export function takePendingQuote(): { file?: File; text?: string } {
  const out = { file: pendingFile ?? undefined, text: pendingText ?? undefined };
  pendingFile = null;
  pendingText = null;
  return out;
}
