// Inline brief editor — lets the homeowner tweak any answer right on the result page.
// Saves go straight through useIntake (already persisted to localStorage), no navigation.
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Video, Map, Save, StickyNote, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import PillGroup from "@/components/PillGroup";
import DimensionsInput from "@/components/intake/DimensionsInput";
import {
  ROOM_LABELS,
  PAIN_BY_ROOM,
  SCOPE_OPTIONS,
  filesToAssets,
  type IntakeData,
  type Room,
  type MediaAsset,
  type Timeline,
  type ScopeTier,
} from "@/lib/intake";

const fmtMoney = (v: number) => (v >= 500 ? "$500K+" : `$${v}K`);

export type EditBriefDrawerProps = {
  open: boolean;
  data: IntakeData;
  onClose: () => void;
  onPatch: (p: Partial<IntakeData>) => void;
  onAddMedia: (a: MediaAsset[]) => void;
  onRemoveMedia: (id: string) => void;
  onTogglePill: (key: "painPoints", value: string) => void;
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-border py-6 first:border-t-0 first:pt-0">
    <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-foreground/70">{title}</p>
    <div className="mt-4">{children}</div>
  </section>
);

const EditBriefDrawer = ({
  open,
  data,
  onClose,
  onPatch,
  onAddMedia,
  onRemoveMedia,
  onTogglePill,
}: EditBriefDrawerProps) => {
  const videoRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const planRef = useRef<HTMLInputElement>(null);

  const [budgetDraft, setBudgetDraft] = useState<[number, number]>([
    data.budgetMin ?? 40,
    data.budgetMax ?? 70,
  ]);

  const rooms = Object.keys(ROOM_LABELS) as Room[];
  const painList = data.room && data.room !== "addition" ? PAIN_BY_ROOM[data.room] : [];

  const timelines: { value: Timeline; label: string }[] = [
    { value: "asap", label: "ASAP" },
    { value: "1-3", label: "1–3 mo" },
    { value: "3-6", label: "3–6 mo" },
    { value: "exploring", label: "Exploring" },
  ];

  const addFiles =
    (kind: MediaAsset["kind"]) => async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length) return;
      const assets = await filesToAssets(e.target.files, kind);
      onAddMedia(assets);
      e.target.value = "";
    };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-background shadow-lift"
          >
            <header className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-accent">Edit brief</p>
                <p className="font-display text-lg font-medium">Tweak anything — saves as you go.</p>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground/70 transition-smooth hover:bg-foreground hover:text-background"
                aria-label="Close editor"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-2">
              {/* Room */}
              <Section title="Room">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {rooms.map((r) => (
                    <button
                      key={r}
                      onClick={() => onPatch({ room: r, painPoints: r === data.room ? data.painPoints : [] })}
                      className={`rounded-xl border p-3 text-left text-xs font-medium transition-smooth ${
                        data.room === r
                          ? "border-accent bg-accent-soft text-foreground ring-1 ring-accent"
                          : "border-border bg-card text-foreground/80 hover:border-accent/40"
                      }`}
                    >
                      {ROOM_LABELS[r]}
                    </button>
                  ))}
                </div>
              </Section>

              {/* Pain points */}
              {painList.length > 0 && (
                <Section title="Pain points">
                  <PillGroup
                    options={painList.map((p) => ({ value: p, label: p }))}
                    selected={data.painPoints}
                    onToggle={(v) => onTogglePill("painPoints", v)}
                  />
                </Section>
              )}

              {/* Media */}
              <Section title="Photos, video & floor plan">
                <div className="grid grid-cols-3 gap-2">
                  <input ref={videoRef} type="file" accept="video/*" onChange={addFiles("video")} className="hidden" />
                  <input ref={photoRef} type="file" accept="image/*" multiple onChange={addFiles("photo")} className="hidden" />
                  <input ref={planRef} type="file" accept="image/*,application/pdf" onChange={addFiles("floorplan")} className="hidden" />
                  <button
                    onClick={() => videoRef.current?.click()}
                    className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-card p-3 text-xs transition-smooth hover:border-accent/60"
                  >
                    <Video className="h-4 w-4 text-accent" /> Add video
                  </button>
                  <button
                    onClick={() => photoRef.current?.click()}
                    className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-card p-3 text-xs transition-smooth hover:border-accent/60"
                  >
                    <Camera className="h-4 w-4 text-accent" /> Add photos
                  </button>
                  <button
                    onClick={() => planRef.current?.click()}
                    className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-card p-3 text-xs transition-smooth hover:border-accent/60"
                  >
                    <Map className="h-4 w-4 text-accent" /> Add plan
                  </button>
                </div>
                {data.media.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {data.media.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center gap-2 rounded-lg bg-secondary/60 px-2 py-1.5 text-xs"
                      >
                        <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-md bg-card">
                          {m.kind === "photo" || m.kind === "inspiration" ? (
                            <img src={m.url} alt="" className="h-full w-full object-cover" />
                          ) : m.kind === "video" ? (
                            <Video className="h-3.5 w-3.5" />
                          ) : (
                            <Map className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span className="flex-1 truncate text-foreground/80">{m.name}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.kind}</span>
                        <button
                          onClick={() => onRemoveMedia(m.id)}
                          className="grid h-6 w-6 place-items-center rounded-full text-foreground/50 transition-smooth hover:bg-destructive hover:text-destructive-foreground"
                          aria-label={`Remove ${m.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Notes & measurements */}
              <Section title="Notes & measurements">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground/70">
                  <StickyNote className="h-3.5 w-3.5 text-accent" /> Rough notes
                </label>
                <Textarea
                  value={data.notes ?? ""}
                  onChange={(e) => onPatch({ notes: e.target.value })}
                  rows={3}
                  placeholder="Anything else worth knowing…"
                  className="mb-3 rounded-xl bg-card text-sm"
                />
                <DimensionsInput
                  value={data.dimensions}
                  onChange={(d) => onPatch({ dimensions: d })}
                />
              </Section>

              {/* Address */}
              <Section title="Project address">
                <div className="grid grid-cols-1 gap-2">
                  <Input
                    placeholder="Street"
                    value={data.address?.street ?? ""}
                    onChange={(e) => onPatch({ address: { ...(data.address ?? {}), street: e.target.value, skipped: false } })}
                    className="rounded-xl bg-card text-sm"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="City"
                      value={data.address?.city ?? ""}
                      onChange={(e) => onPatch({ address: { ...(data.address ?? {}), city: e.target.value, skipped: false } })}
                      className="col-span-2 rounded-xl bg-card text-sm"
                    />
                    <Input
                      placeholder="State"
                      maxLength={2}
                      value={data.address?.state ?? ""}
                      onChange={(e) => onPatch({ address: { ...(data.address ?? {}), state: e.target.value.toUpperCase(), skipped: false } })}
                      className="rounded-xl bg-card text-sm uppercase"
                    />
                  </div>
                  <Input
                    placeholder="Zip"
                    value={data.address?.zip ?? ""}
                    onChange={(e) => onPatch({ address: { ...(data.address ?? {}), zip: e.target.value, skipped: false } })}
                    className="rounded-xl bg-card text-sm"
                  />
                </div>
                <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> Street stays private — only city is shared with contractors.
                </p>
              </Section>

              {/* Scope */}
              <Section title="Scope of work">
                <div className="grid grid-cols-2 gap-2">
                  {SCOPE_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => onPatch({ scope: s.value as ScopeTier })}
                      className={`rounded-xl border p-3 text-left text-xs transition-smooth ${
                        data.scope === s.value
                          ? "border-accent bg-accent-soft ring-1 ring-accent"
                          : "border-border bg-card hover:border-accent/40"
                      }`}
                    >
                      <p className="font-display text-sm font-medium">{s.label}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{s.oneLiner}</p>
                    </button>
                  ))}
                </div>
              </Section>



              {/* Budget */}
              <Section title="Budget">
                {data.budgetSkipped ? (
                  <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
                    <p className="text-sm text-muted-foreground">Skipped</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPatch({ budgetSkipped: false, budgetMin: 40, budgetMax: 70 })}
                    >
                      Set a range
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-center font-display text-2xl font-medium tabular-nums">
                      {fmtMoney(budgetDraft[0])} <span className="text-muted-foreground">–</span> {fmtMoney(budgetDraft[1])}
                    </p>
                    <Slider
                      value={budgetDraft}
                      min={5}
                      max={500}
                      step={5}
                      minStepsBetweenThumbs={1}
                      onValueChange={(v) => {
                        const tup: [number, number] = [v[0], v[1]];
                        setBudgetDraft(tup);
                        onPatch({ budgetMin: v[0], budgetMax: v[1], budgetSkipped: false });
                      }}
                      className="mt-4"
                    />
                    <button
                      onClick={() => onPatch({ budgetSkipped: true, budgetMin: undefined, budgetMax: undefined })}
                      className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      I'd rather not say
                    </button>
                  </div>
                )}
              </Section>

              {/* Timeline */}
              <Section title="Timeline">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {timelines.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => onPatch({ timeline: t.value })}
                      className={`rounded-xl border p-2.5 text-xs font-medium transition-smooth ${
                        data.timeline === t.value
                          ? "border-accent bg-accent-soft ring-1 ring-accent"
                          : "border-border bg-card hover:border-accent/40"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Section>
            </div>

            <footer className="flex items-center justify-between border-t border-border px-6 py-4">
              <p className="text-xs text-muted-foreground">Changes save automatically.</p>
              <Button onClick={onClose} className="rounded-full">
                <Save className="h-4 w-4" /> Done
              </Button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default EditBriefDrawer;
