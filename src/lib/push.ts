// Subscribes the current contractor to web push notifications.
// Honors a "deferred" flag so we don't nag if they dismissed the prompt.
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BCzEEOsOmZdT1nub2_hQXquoty85kAB6aEiqsR1WmAdp_pbK59_O4qAiNyW2TeqT8YtvHL9Y_oI47yxHVrDjrd0";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function isPushSupported(): Promise<boolean> {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getPushPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!(await isPushSupported())) return "unsupported";
  return Notification.permission;
}

export async function subscribeToPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!(await isPushSupported())) return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: permission };

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subJson = sub.toJSON();
  const { error } = await supabase.functions.invoke("save-push-subscription", {
    body: { subscription: subJson, userAgent: navigator.userAgent },
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function deferPushPermission(contractorId: string) {
  await supabase.from("contractors").update({ push_permission_deferred: true }).eq("id", contractorId);
}
