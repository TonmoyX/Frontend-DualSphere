"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Eye, KeyRound, Laptop, LogOut, Palette, ShieldCheck, ShieldOff, Smartphone, UserRound } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ThemePicker } from "@/components/common/theme-picker";
import { AvatarUploadDialog } from "@/components/profile/avatar-upload-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner, TimeAgo, UserAvatar } from "@/components/common/bits";
import { FieldError } from "@/components/layout/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { del, errorMessage, get, post, put } from "@/lib/api";
import type { SelfUser, Session } from "@/lib/types";
import { uploadMedia } from "@/lib/upload";
import { useAuth } from "@/providers/auth-provider";

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {desc && <p className="mb-4 text-sm text-muted-foreground">{desc}</p>}
      <div className={desc ? "" : "mt-4"}>{children}</div>
    </div>
  );
}

function ProfileTab({ user }: { user: SelfUser }) {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => put<{ user: SelfUser }>("/users/me", body),
    onSuccess: ({ user: u }) => {
      qc.setQueryData(["me"], u);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const uploadImage = async (file: File | undefined, purpose: "avatar" | "cover") => {
    if (!file) return;
    setUploading(purpose);
    try {
      const m = await uploadMedia(file, purpose);
      await save.mutateAsync(purpose === "avatar" ? { avatarMediaId: m.id } : { coverMediaId: m.id });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-4">
      <Section title="Photos" desc="Images are stripped of location metadata before upload.">
        <div className="relative mb-12 h-32 overflow-visible rounded-xl bg-gradient-to-br from-identity/40 via-primary/20 to-anon/20 bg-cover bg-center" style={user.coverUrl ? { backgroundImage: `url(${user.coverUrl})` } : undefined}>
          <Button size="xs" variant="secondary" className="absolute top-2 right-2" onClick={() => coverRef.current?.click()} disabled={!!uploading}>
            {uploading === "cover" ? <Spinner /> : <Camera />} Cover
          </Button>
          <button onClick={() => setAvatarOpen(true)} className="group absolute -bottom-10 left-4 rounded-full" disabled={!!uploading} aria-label="Change avatar">
            <UserAvatar src={user.avatarUrl} name={user.displayName} className="size-20 border-4 border-card" />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              {uploading === "avatar" ? <Spinner /> : <Camera className="size-5" />}
            </span>
          </button>
          <input ref={avatarRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadImage(e.target.files?.[0], "avatar")} />
          <input ref={coverRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadImage(e.target.files?.[0], "cover")} />
        </div>
        {user.avatarUrl && (
          <Button variant="ghost" size="xs" onClick={() => save.mutate({ avatarMediaId: null })}>Remove avatar</Button>
        )}
        <AvatarUploadDialog open={avatarOpen} onOpenChange={setAvatarOpen} />
      </Section>

      <Section title="Public profile">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate({ displayName, bio }); }}>
          <div className="space-y-1.5">
            <Label htmlFor="dn">Display name</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={64} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} className="min-h-24" />
            <p className="text-right text-xs text-muted-foreground tabular-nums">{bio.length}/300</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><Label className="text-muted-foreground">Username</Label><p className="mt-1">@{user.username}</p></div>
            <div><Label className="text-muted-foreground">Email (private)</Label><p className="mt-1">{user.email} {user.isVerified ? "✓" : "(unverified)"}</p></div>
          </div>
          <Button disabled={save.isPending}>{save.isPending && <Spinner />} Save changes</Button>
        </form>
      </Section>
    </div>
  );
}

function SecurityTab({ user }: { user: SelfUser }) {
  const { refetch } = useAuth();
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [disablePw, setDisablePw] = useState("");

  const changePw = useMutation({
    mutationFn: () => post("/auth/change-password", pw),
    onSuccess: () => { toast.success("Password changed. Other sessions were signed out."); setPw({ currentPassword: "", newPassword: "" }); setPwErr(null); },
    onError: (e) => setPwErr(errorMessage(e)),
  });
  const startMfa = useMutation({ mutationFn: () => post<{ qrDataUrl: string; secret: string }>("/auth/mfa/setup"), onSuccess: setSetup, onError: (e) => toast.error(errorMessage(e)) });
  const enableMfa = useMutation({
    mutationFn: () => post("/auth/mfa/enable", { code }),
    onSuccess: () => { toast.success("Two-factor authentication enabled"); setSetup(null); setCode(""); refetch(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const disableMfa = useMutation({
    mutationFn: () => post("/auth/mfa/disable", { code, password: disablePw }),
    onSuccess: () => { toast.success("Two-factor authentication disabled"); setCode(""); setDisablePw(""); refetch(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <Section title="Change password" desc="Changing your password signs out every other session.">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); changePw.mutate(); }}>
          <PasswordInput placeholder="Current password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
          <PasswordInput placeholder="New password (8+ chars, letter + number)" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={8} />
          <FieldError msg={pwErr} />
          <Button disabled={changePw.isPending}><KeyRound /> Update password</Button>
        </form>
      </Section>

      <Section title="Two-factor authentication" desc="Protect your account with an authenticator app (Google Authenticator, 1Password, Authy).">
        {user.mfaEnabled ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-anon"><ShieldCheck className="size-4" /> 2FA is on.</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <PasswordInput placeholder="Password" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} />
              <Input placeholder="6-digit code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <Button variant="destructive" onClick={() => disableMfa.mutate()} disabled={code.length !== 6 || !disablePw || disableMfa.isPending}><ShieldOff /> Disable</Button>
            </div>
          </div>
        ) : setup ? (
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrDataUrl} alt="Scan with your authenticator app" className="size-44 rounded-lg bg-white p-2" />
            <div className="flex-1 space-y-3 text-sm">
              <p>1. Scan this QR code with your authenticator app.</p>
              <p className="text-muted-foreground">Or enter this key manually: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">{setup.secret}</code></p>
              <p>2. Enter the 6-digit code to confirm.</p>
              <div className="flex gap-2">
                <Input placeholder="000000" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-32 text-center font-mono tracking-widest" />
                <Button onClick={() => enableMfa.mutate()} disabled={code.length !== 6 || enableMfa.isPending}>Enable 2FA</Button>
              </div>
            </div>
          </div>
        ) : (
          <Button onClick={() => startMfa.mutate()} disabled={startMfa.isPending}>{startMfa.isPending ? <Spinner /> : <ShieldCheck />} Set up 2FA</Button>
        )}
      </Section>
    </div>
  );
}

function PrivacyTab({ user }: { user: SelfUser }) {
  const qc = useQueryClient();
  const blocks = useQuery({ queryKey: ["blocks"], queryFn: () => get<{ blocks: { id: string; username: string; displayName: string; avatarUrl: string | null }[] }>("/blocks") });
  const activity = useMutation({
    mutationFn: (v: boolean) => put<{ user: SelfUser }>("/users/me", { showActivity: v }),
    onSuccess: ({ user: u }) => { qc.setQueryData(["me"], u); toast.success(u.showActivity ? "Activity status on" : "Activity status off"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const lock = useMutation({
    mutationFn: (v: boolean) => put<{ user: SelfUser }>("/users/me", { profileLocked: v }),
    onSuccess: ({ user: u }) => { qc.setQueryData(["me"], u); qc.invalidateQueries({ queryKey: ["profile"] }); toast.success(u.profileLocked ? "Profile locked" : "Profile unlocked"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const friendsVis = useMutation({
    mutationFn: (v: "public" | "friends" | "only_me") => put<{ user: SelfUser }>("/users/me", { friendsVisibility: v }),
    onSuccess: ({ user: u }) => { qc.setQueryData(["me"], u); qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Friends list visibility updated"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const unblock = useMutation({
    mutationFn: (id: string) => del(`/blocks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blocks"] }); qc.invalidateQueries({ queryKey: ["dm"] }); toast.success("Unblocked"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-4">
      <Section title="Lock profile" desc="When your profile is locked, only your friends can see your posts, bio, cover photo and friends list on your profile.">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm">{user.profileLocked ? "Your profile is locked" : "Lock my profile"}</span>
          <Switch checked={user.profileLocked} onCheckedChange={(v) => lock.mutate(v)} />
        </label>
      </Section>
      <Section title="Who can see your friends list?" desc="People who can't see your full list will still see the friends you have in common.">
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
          {([
            ["public", "Everyone", "Anyone on DualSphere"],
            ["friends", "Friends", "Only your friends"],
            ["only_me", "Only me", "Others see mutual friends only"],
          ] as const).map(([v, label, hint]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={user.friendsVisibility === v}
              onClick={() => friendsVis.mutate(v)}
              className={`rounded-xl border-2 p-3 text-left transition-colors ${user.friendsVisibility === v ? "border-primary bg-primary/5" : "border-transparent bg-muted/50 hover:border-border"}`}
            >
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Activity status" desc="Show people you chat with when you're active or were recently active. If you turn this off, you won't see their activity status either.">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm">Show activity status</span>
          <Switch checked={user.showActivity} onCheckedChange={(v) => activity.mutate(v)} />
        </label>
      </Section>
      <Section title="Blocked accounts" desc="Blocked people can't message you or add you to groups. They aren't notified.">
        {blocks.isLoading && <Spinner />}
        {blocks.data?.blocks.length === 0 && <p className="text-sm text-muted-foreground">You haven&apos;t blocked anyone.</p>}
        <div className="divide-y">
          {blocks.data?.blocks.map((b) => (
            <div key={b.id} className="flex items-center gap-3 py-2.5">
              <UserAvatar src={b.avatarUrl} name={b.displayName} className="size-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">@{b.username}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => unblock.mutate(b.id)}>Unblock</Button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function SessionsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["sessions"], queryFn: () => get<{ sessions: Session[] }>("/auth/sessions") });
  const revoke = useMutation({
    mutationFn: (id?: string) => del(id ? `/auth/sessions/${id}` : "/auth/sessions"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessions"] }); toast.success("Session(s) revoked"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Section title="Active sessions" desc="Devices currently signed in to your account. Revoke anything you don't recognise.">
      {isLoading && <Spinner />}
      <div className="divide-y">
        {data?.sessions.map((s) => {
          const mobile = /mobile|android|iphone/i.test(s.userAgent ?? "");
          return (
            <div key={s.id} className="flex items-center gap-3 py-3">
              <div className="grid size-9 place-items-center rounded-lg bg-muted">{mobile ? <Smartphone className="size-4" /> : <Laptop className="size-4" />}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{s.userAgent || "Unknown device"}</p>
                <p className="text-xs text-muted-foreground">
                  {s.current ? <span className="text-anon">This device</span> : <>Active <TimeAgo date={s.lastUsedAt} /> ago</>}
                </p>
              </div>
              {!s.current && <Button variant="ghost" size="sm" onClick={() => revoke.mutate(s.id)}>Revoke</Button>}
            </div>
          );
        })}
      </div>
      {(data?.sessions.length ?? 0) > 1 && (
        <Button variant="destructive" size="sm" className="mt-3" onClick={() => revoke.mutate(undefined)}><LogOut /> Sign out all other sessions</Button>
      )}
    </Section>
  );
}

const TABS = ["profile", "security", "privacy", "sessions", "appearance"] as const;

export default function SettingsPage() {
  return <Suspense><SettingsInner /></Suspense>;
}

function SettingsInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const requested = useSearchParams().get("tab");
  const initialTab = (TABS as readonly string[]).includes(requested ?? "") ? requested! : "profile";
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/settings");
  }, [loading, user, router]);
  if (!user) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-6" /></div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold">Settings</h1>
      <Tabs key={initialTab} defaultValue={initialTab}>
        <TabsList className="mb-4 flex h-auto w-full justify-start overflow-x-auto [scrollbar-width:none] sm:w-fit [&>button]:shrink-0">
          <TabsTrigger value="profile"><UserRound /> Profile</TabsTrigger>
          <TabsTrigger value="security"><ShieldCheck /> Security</TabsTrigger>
          <TabsTrigger value="privacy"><Eye /> Privacy</TabsTrigger>
          <TabsTrigger value="sessions"><Laptop /> Sessions</TabsTrigger>
          <TabsTrigger value="appearance"><Palette /> Appearance</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><ProfileTab user={user} /></TabsContent>
        <TabsContent value="security"><SecurityTab user={user} /></TabsContent>
        <TabsContent value="privacy"><PrivacyTab user={user} /></TabsContent>
        <TabsContent value="sessions"><SessionsTab /></TabsContent>
        <TabsContent value="appearance">
          <Section title="Theme" desc="Choose how DualSphere looks on this device.">
            <ThemePicker />
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
