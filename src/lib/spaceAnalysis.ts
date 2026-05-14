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
import { extractVideoFrames } from "@/lib/videoFrames";

const SESSION_KEY = "haleo:session:v1";
const UPLOADED_KEY = "haleo:uploaded:v1"; // map<assetId, publicUrl>
const VIDEO_FRAMES_KEY = "haleo:videoframes:v1"; // map<assetId, publicUrl[]>
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

// What we send to analyze-space. "video_frame" is a synthetic kind produced
// client-side by sampling stills out of an uploaded walkthrough video.
export type AnalyzeMediaKind = MediaAsset["kind"] | "video_frame";
export type AnalyzeMediaInput = { kind: AnalyzeMediaKind; url: string; mime?: string };

const readVideoFrameCache = (): Record<string, string[]> => {
  try {
    return JSON.parse(localStorage.getItem(VIDEO_FRAMES_KEY) ?? "{}");
  } catch {
    return {};
  }
};
const writeVideoFrameCache = (map: Record<string, string[]>) => {
  try {
    localStorage.setItem(VIDEO_FRAMES_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
};

// Pull the actual File for a video asset back out of its blob URL, sample
// frames, upload each frame to the same intake-media bucket, and cache the
// resulting public URLs so re-running the brief is free.
export const extractAndUploadVideoFrames = async (
  asset: MediaAsset,
  sessionId: string,
): Promise<string[]> => {
  if (asset.kind !== "video") return [];
  const cache = readVideoFrameCache();
  if (cache[asset.id]?.length) return cache[asset.id];

  // Re-fetch the video blob from its session URL, then materialize as a File
  // so the extractor can read duration/dimensions.
  let file: File | null = null;
  try {
    const res = await fetch(asset.url);
    if (!res.ok) return [];
    const blob = await res.blob();
    file = new File([blob], asset.name || "video.mp4", {
      type: asset.mime || blob.type || "video/mp4",
    });
  } catch (err) {
    console.error("video fetch failed", err);
    return [];
  }

  const frames = await extractVideoFrames(file, 6);
  if (frames.length === 0) return [];

  const uploadedUrls: string[] = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const path = `${sessionId}/${asset.id}-frame-${String(i).padStart(2, "0")}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f.blob, {
      cacheControl: "3600",
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) {
      console.error("frame upload failed", error);
      continue;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    uploadedUrls.push(data.publicUrl);
  }

  if (uploadedUrls.length > 0) {
    cache[asset.id] = uploadedUrls;
    writeVideoFrameCache(cache);
  }
  return uploadedUrls;
};

export const runSpaceAnalysis = async (
  sessionId: string,
  intake: IntakeData,
  mediaUrls: AnalyzeMediaInput[],
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

const RESULT_CACHE_KEY = "haleo:analysis:v2";
const FALLBACK_SUMMARY = "No analyzable visuals on file yet. Add at least one photo, a short video, or a plan PDF to generate a grounded read.";
const readCachedResult = (key: string): SpaceAnalysis | null => {
  try {
    const raw = localStorage.getItem(RESULT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, SpaceAnalysis>;
    const cached = parsed[key] ?? null;
    if (!cached) return null;
    if (cached.summary === FALLBACK_SUMMARY || cached.summary.startsWith("No analyzable ")) {
      return null;
    }
    return cached;
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
        const uploaded: AnalyzeMediaInput[] = [];
        for (const a of analyzable) {
          const url = await uploadMediaIfNeeded(a, sessionId);
          if (url) uploaded.push({ kind: a.kind, url, mime: a.mime });

          // For videos, also sample stills client-side and upload them so
          // Haleo can actually "see" the walkthrough.
          if (a.kind === "video") {
            try {
              const frameUrls = await extractAndUploadVideoFrames(a, sessionId);
              for (const frameUrl of frameUrls) {
                uploaded.push({ kind: "video_frame", url: frameUrl, mime: "image/jpeg" });
              }
            } catch (err) {
              console.warn("Video frame extraction failed; analysis will rely on photos only.", err);
            }
          }
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
