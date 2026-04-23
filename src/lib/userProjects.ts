// Per-user persistent storage of intakes + briefs.
// One row per "room" the user is working on, scoped via RLS to user_id.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { ROOM_LABELS, type IntakeData, type Room } from "@/lib/intake";

export interface UserProject {
  id: string;
  user_id: string;
  title: string | null;
  room: string | null;
  intake: IntakeData;
  brief: unknown | null;
  status: "draft" | "brief_ready" | "sent";
  created_at: string;
  updated_at: string;
}

const titleFor = (intake: IntakeData): string => {
  const room = intake.room ? ROOM_LABELS[intake.room as Room] ?? intake.room : "Project";
  const city = intake.address?.city;
  return city ? `${room} · ${city}` : room;
};

// Strip non-serialisable / huge bits before persisting (object URLs etc.).
const sanitizeIntake = (intake: IntakeData): IntakeData => ({
  ...intake,
  media: (intake.media ?? []).map((m) => ({
    ...m,
    url: m.uploadedUrl ?? (m.url?.startsWith("blob:") ? "" : m.url ?? ""),
  })),
});

export async function listMyProjects(): Promise<UserProject[]> {
  const { data, error } = await supabase
    .from("user_projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as UserProject[];
}

export async function getProject(id: string): Promise<UserProject | null> {
  const { data, error } = await supabase.from("user_projects").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as UserProject | null;
}

export async function saveDraft(intake: IntakeData, existingId?: string): Promise<UserProject> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const payload = {
    user_id: user.id,
    title: titleFor(intake),
    room: intake.room ?? null,
    intake: sanitizeIntake(intake) as unknown as Json,
    status: "draft" as const,
  };

  if (existingId) {
    const { data, error } = await supabase
      .from("user_projects")
      .update(payload)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as UserProject;
  }

  const { data, error } = await supabase.from("user_projects").insert(payload).select("*").single();
  if (error) throw error;
  return data as unknown as UserProject;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("user_projects").delete().eq("id", id);
  if (error) throw error;
}