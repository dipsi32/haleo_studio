// Copying text from a tap, reliably on phones.
/** Copy that works inside a tap on every phone (the async clipboard API can be refused after an await). */
export const copyText = (text: string): boolean => {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return true;
  } catch {
    /* fall through */
  }
  void navigator.clipboard?.writeText(text).catch(() => undefined);
  return true;
};

