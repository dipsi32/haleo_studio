// Client-side video frame extraction.
//
// Why this exists: Lovable AI Gateway / Gemini reads images well, but routing
// raw video bytes through the OpenAI-compat shim isn't reliable. So instead of
// shipping the video to the model, we sample N evenly-spaced frames in the
// browser using <video> + <canvas>, then send those frames to `analyze-space`
// as image inputs labeled "video frames" so the prompt knows to hedge on
// dimensions.
//
// No new dependencies. No ffmpeg. Works on the same Supabase Storage bucket
// the photos already use.

export type ExtractedFrame = {
  blob: Blob;
  // Seconds into the video this frame was sampled from.
  timestamp: number;
};

const DEFAULT_FRAME_COUNT = 6;
const FRAME_MIME = "image/jpeg";
const FRAME_QUALITY = 0.82;
const MAX_DIMENSION = 1280; // downscale large videos to keep frames small

const seekVideo = (video: HTMLVideoElement, time: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      // One animation frame to make sure the new frame is composited.
      requestAnimationFrame(() => resolve());
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("Video seek failed"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    // Clamp — some browsers reject seeks past duration.
    try {
      video.currentTime = Math.max(0, Math.min(time, video.duration - 0.05));
    } catch (err) {
      onError();
    }
  });

const loadVideo = (file: File): Promise<HTMLVideoElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.src = url;

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("error", onError);
    };
    const onMeta = () => {
      cleanup();
      // Some browsers need a play()/pause() to populate dimensions on iOS.
      resolve(video);
    };
    const onError = () => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error("Could not load video"));
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("error", onError);
  });

/**
 * Extract evenly-spaced still frames from a video File.
 * Skips the very first/last 5% so we don't get black title/end frames.
 */
export const extractVideoFrames = async (
  file: File,
  count: number = DEFAULT_FRAME_COUNT,
): Promise<ExtractedFrame[]> => {
  if (typeof window === "undefined") return [];
  const video = await loadVideo(file);
  const duration = isFinite(video.duration) ? video.duration : 0;
  if (duration <= 0) {
    URL.revokeObjectURL(video.src);
    return [];
  }

  // Sample timestamps in the middle 90% of the video.
  const head = duration * 0.05;
  const tail = duration * 0.95;
  const span = tail - head;
  const stamps =
    count <= 1
      ? [duration / 2]
      : Array.from({ length: count }, (_, i) => head + (span * i) / (count - 1));

  // Compute scaled canvas size (preserve aspect).
  const vw = video.videoWidth || MAX_DIMENSION;
  const vh = video.videoHeight || MAX_DIMENSION;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(vw, vh));
  const cw = Math.max(1, Math.round(vw * scale));
  const ch = Math.max(1, Math.round(vh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(video.src);
    return [];
  }

  const frames: ExtractedFrame[] = [];
  for (const t of stamps) {
    try {
      await seekVideo(video, t);
      ctx.drawImage(video, 0, 0, cw, ch);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), FRAME_MIME, FRAME_QUALITY),
      );
      if (blob) frames.push({ blob, timestamp: t });
    } catch (err) {
      console.warn("Frame extract failed at", t, err);
    }
  }

  URL.revokeObjectURL(video.src);
  return frames;
};
