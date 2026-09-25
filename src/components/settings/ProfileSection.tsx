"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, Button, Input } from "@/components/ui";
import { BUSINESS_TYPES } from "@/lib/domain-vocabulary";
import { uploadImage } from "@/utils/clientUploads";

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  freelancer: "Freelancer",
  contractor: "Contractor",
  studio: "Studio",
  consultant: "Consultant",
  creator: "Creator",
  small_business: "Small business",
};

export type ProfileSectionData = {
  email: string;
  name: string | null;
  profession: string | null;
  businessTypes: string[];
  avatarUrl: string | null;
};

export function ProfileSection({ data }: { data: ProfileSectionData }) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(data.name || "");
  const [profession, setProfession] = useState(data.profession || "");
  const [businessTypes, setBusinessTypes] = useState<string[]>(data.businessTypes.length ? data.businessTypes : []);
  const [avatarUrl, setAvatarUrl] = useState(data.avatarUrl || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleType = (type: string) => {
    setBusinessTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  };

  const onPickAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setAvatarUrl(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (businessTypes.length === 0) { toast.error("Choose at least one business type."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, profession, businessTypes, avatarUrl }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Profile could not be saved.");
      toast.success("Profile saved.");
      // The workspace shell shows the name and photo in the sidebar; let it update without a reload.
      window.dispatchEvent(new CustomEvent("rive:profile-updated", { detail: { name: payload.user?.name ?? name, avatar_url: payload.user?.avatarUrl ?? null } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="profile" className="scroll-mt-24 rounded-none border border-border bg-card p-5">
      <h2 className="font-semibold">Profile</h2>
      <p className="mt-1 text-xs text-muted-foreground">How you show up across rive. and on client-facing documents.</p>
      <form onSubmit={save} className="mt-5 space-y-5">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
          ) : (
            <Avatar size="lg" className="h-16 w-16 text-lg">{(name || data.email || "?").slice(0, 1).toUpperCase()}</Avatar>
          )}
          <div>
            {/* A real button, so the upload is reachable by keyboard; the file input stays hidden. */}
            <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading…" : "Change photo"}
            </Button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden="true" onChange={(event) => void onPickAvatar(event)} disabled={uploading} />
            {avatarUrl ? <Button type="button" variant="ghost" size="sm" className="ml-2 text-muted-foreground" onClick={() => setAvatarUrl("")}>Remove</Button> : null}
            <p className="mt-2 max-w-sm text-xs text-muted-foreground">Also used as your portfolio photo. It appears publicly only if you turn on &ldquo;Show on public portfolio&rdquo; in Portfolio Studio.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted-foreground">Name<Input value={name} onChange={(event) => setName(event.target.value)} className="mt-2" required /></label>
          <label className="text-xs font-semibold text-muted-foreground">Email<Input value={data.email} readOnly disabled className="mt-2 opacity-70" /></label>
          <label className="text-xs font-semibold text-muted-foreground sm:col-span-2">Profession<Input value={profession} onChange={(event) => setProfession(event.target.value)} placeholder="e.g. Brand designer" className="mt-2" /></label>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Business type</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {BUSINESS_TYPES.map((type) => {
              const active = businessTypes.includes(type);
              return (
                <button
                  type="button"
                  key={type}
                  onClick={() => toggleType(type)}
                  aria-pressed={active}
                  className={`rounded-none border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                >
                  {BUSINESS_TYPE_LABELS[type] || type}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || uploading}>{saving ? "Saving…" : "Save profile"}</Button>
        </div>
      </form>
    </section>
  );
}
