// Space Analysis client — uploads intake media to Cloud storage, then asks the
// `analyze-space` edge function to produce a contractor-readable read.
//
// Sessions are anonymous (no auth yet): we mint a stable per-browser session
// id stored in localStorage so re-running the brief reuses the same folder.
//
// Public API:
//   getSessionId()                       → stable anon id
//   uploadMediaIfNeeded(asset)           → returns public URL (uploads on first call)
//   runSpaceAnalysis(intake, mediaUrls)  → invokes edge fn, returns sections
//   useSpaceAnalysis(intake)             → hook: orchestrates upload + analyze
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { IntakeData, MediaAsset } from "@/lib/intake";
import type { AnalysisSection } from "@/lib/brief";

const SESSION_KEY = "haleo:session:v1";
const UPLOADED_KEY = "haleo:uploaded:v1"; // map<assetId, publicUrl>
const BUCKET = "intake-media";

export type SpaceAnalysisStatus = "idle" | "uploading" | "analyzing" | "ready" | "error";

export type SpaceAnalysis = {
  summary: string;
  sections: AnalysisSection[];
};

export const getSessionId = (): string => {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

const readUploaded = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(UPLOADED_KEY) ?? "{}");
  } catch {
    return {};
  }
};
const writeUploaded = (map: Record<string, string>) => {
  try {
    localStorage.setItem(UPLOADED_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
};

// Re-fetch the live File from the asset's blob URL — works because the URL
// belongs to the same document and Blob URLs are fetchable.
const fetchAssetBlob = async (asset: MediaAsset): Promise<Blob | null> => {
  if (!asset.url) return null;
  try {
    const res = await fetch(asset.url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
};

export const uploadMediaIfNeeded = async (
  asset: MediaAsset,
  sessionId: string,
): Promise<string | null> => {
  const cache = readUploaded();
  if (cache[asset.id]) return cache[asset.id];

  const blob = await fetchAssetBlob(asset);
  if (!blob) return null;

  // Sanitize filename — storage doesn't love spaces.
  const safeName = asset.name.replace(/[^\w.\-]+/g, "_");
  const path = `${sessionId}/${asset.id}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "3600",
    contentType: asset.mime || blob.type || "application/octet-stream",
    upsert: true,
  });
  if (error) {
    console.error("storage upload failed", error);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  cache[asset.id] = data.publicUrl;
  writeUploaded(cache);
  return data.publicUrl;
};

export const runSpaceAnalysis = async (
  sessionId: string,
  intake: IntakeData,
  mediaUrls: { kind: MediaAsset["kind"]; url: string; mime?: string }[],
): Promise<SpaceAnalysis> => {
  const { data, error } = await supabase.functions.invoke("analyze-space", {
    body: { sessionId, intake, mediaUrls },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "analyze-space failed");
  return data.result as SpaceAnalysis;
};

// ───── Hook ─────
// Triggers an analysis whenever the intake "media set" changes. Caches the
// result in localStorage so navigating away and back doesn't re-spend tokens.

const RESULT_CACHE_KEY = "haleo:analysis:v1";
const readCachedResult = (key: string): SpaceAnalysis | null => {
  try {
    const raw = localStorage.getItem(RESULT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, SpaceAnalysis>;
    return parsed[key] ?? null;
  } catch {
    return null;
  }
};
const writeCachedResult = (key: string, value: SpaceAnalysis) => {
  try {
    const raw = localStorage.getItem(RESULT_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, SpaceAnalysis>) : {};
    parsed[key] = value;
    localStorage.setItem(RESULT_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
};

// Stable cache key: media ids + scope + room + pain points
const buildCacheKey = (intake: IntakeData): string => {
  const ids = intake.media.map((m) => m.id).sort().join(",");
  return `${intake.room ?? "_"}|${intake.scope ?? "_"}|${(intake.painPoints ?? [])
    .slice()
    .sort()
    .join(",")}|${ids}`;
};

export const useSpaceAnalysis = (intake: IntakeData) => {
  const [status, setStatus] = useState<SpaceAnalysisStatus>("idle");
  const [analysis, setAnalysis] = useState<SpaceAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);

  useEffect(() => {
    const cacheKey = buildCacheKey(intake);
    const cached = readCachedResult(cacheKey);
    if (cached) {
      setAnalysis(cached);
      setStatus("ready");
      return;
    }

    // Need at least some media to analyze
    const analyzable = intake.media.filter(
      (m) => m.kind === "photo" || m.kind === "floorplan" || m.kind === "video",
    );
    if (analyzable.length === 0) {
      setAnalysis(null);
      setStatus("idle");
      return;
    }

    if (inFlight.current === cacheKey) return;
    inFlight.current = cacheKey;

    const run = async () => {
      try {
        setStatus("uploading");
        setError(null);
        const sessionId = getSessionId();
        const uploaded: { kind: MediaAsset["kind"]; url: string; mime?: string }[] = [];
        for (const a of analyzable) {
          const url = await uploadMediaIfNeeded(a, sessionId);
          if (url) uploaded.push({ kind: a.kind, url, mime: a.mime });
        }
        if (uploaded.length === 0) {
          throw new Error("Could not upload any media — try re-adding the files.");
        }
        setStatus("analyzing");
        const result = await runSpaceAnalysis(sessionId, intake, uploaded);
        writeCachedResult(cacheKey, result);
        setAnalysis(result);
        setStatus("ready");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Analysis failed";
        setError(msg);
        setStatus("error");
      } finally {
        inFlight.current = null;
      }
    };
    run();
    // Re-run when the cache key changes (media set, room, scope, pain points).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildCacheKey(intake)]);

  return { status, analysis, error };
};
