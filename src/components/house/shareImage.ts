// Turning a card on screen into an image people can post: the fonts inlined
// (html-to-image can't read the Google Fonts stylesheet across origins), the
// PNG made at full resolution, then shared or saved. Used by the house card,
// House Wrapped and anything else people share as a picture.
import { toBlob } from "html-to-image";

const FONT_CSS = "https://fonts.googleapis.com/css2?family=Outfit:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Figtree:wght@400;500;600&display=swap";
let fontCache: Promise<string> | null = null;

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

export const embeddedFonts = () =>
  (fontCache ??= (async () => {
    try {
      let css = await (await fetch(FONT_CSS)).text();
      // Latin only: the cards are English, and it keeps the image fast.
      css = css
        .split("/*")
        .filter((block) => !block.trim() || /^\s*latin \*\//.test(block))
        .map((block, i) => (i === 0 ? block : `/*${block}`))
        .join("");
      const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
      const inlined = await Promise.all(urls.map(async (u) => [u, await toDataUrl(await (await fetch(u)).blob())] as const));
      for (const [u, data] of inlined) css = css.split(u).join(data);
      return css;
    } catch {
      return "";
    }
  })());

/** The element as a PNG file, `width` pixels wide. */
export const elementImage = async (el: HTMLElement, o: { name: string; width: number; drawnAt: number; background: string }): Promise<File | null> => {
  const fontEmbedCSS = await embeddedFonts();
  const blob = await toBlob(el, {
    pixelRatio: o.width / o.drawnAt,
    cacheBust: true,
    backgroundColor: o.background,
    ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
  });
  return blob ? new File([blob], o.name, { type: "image/png" }) : null;
};

export const saveFile = (file: File) => {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/** Share sheet with the image when the phone supports it; otherwise save it. */
export const shareFile = async (file: File, text: string): Promise<"shared" | "saved"> => {
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text });
    return "shared";
  }
  saveFile(file);
  return "saved";
};
