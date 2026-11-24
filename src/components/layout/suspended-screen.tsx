"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Clock, Download, LogOut, Menu, ShieldAlert, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo, Spinner, TimeAgo } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage, get, post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useSettings } from "@/providers/settings-provider";

interface Appeal {
  id: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  response: string | null;
  createdAt: string;
  reviewedAt: string | null;
}
type Suspension =
  | { suspended: false }
  | {
      suspended: true;
      user: { username: string; displayName: string; avatarUrl: string | null };
      reason: string | null;
      until: string | null; // null = permanent
      appeal: Appeal | null;
      canAppeal: boolean;
      nextAppealAt: string | null;
    };

/** Shown instead of every page while the signed-in account is suspended. */
export function SuspendedScreen() {
  const { logout, setSuspended, refetch } = useAuth();
  const settings = useSettings();
  const router = useRouter();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState(false);

  const q = useQuery({
    queryKey: ["suspension"],
    queryFn: () => get<Suspension>("/account/suspension"),
    refetchInterval: 60_000, // notices a decision (or the ban ending) without a reload
    retry: false,
  });

  // Restored, or the session is gone
  useEffect(() => {
    if (q.data && !q.data.suspended) {
      setSuspended(false);
      void refetch();
      toast.success("Your account has been restored. Welcome back!");
    } else if (q.error instanceof ApiError && q.error.status === 401) {
      setSuspended(false);
      router.replace("/login");
    }
  }, [q.data, q.error, setSuspended, refetch, router]);

  const appeal = useMutation({
    mutationFn: () => post<Suspension>("/account/suspension/appeal", { message }),
    onSuccess: (d) => {
      qc.setQueryData(["suspension"], d);
      setMessage("");
      toast.success("Request sent — our team will review it");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const download = async () => {
    setDownloading(true);
    try {
      const data = await get<{ account: { username: string }; exportedAt: string }>("/account/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `dualsphere-${data.account.username}-${data.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Your information is downloading");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  const signOut = async () => {
    await logout();
    router.replace("/login");
  };

  const s = q.data?.suspended ? q.data : null;
  const last = s?.appeal ?? null;
  const showForm = !!s?.canAppeal && last?.status !== "pending";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-card/80 px-4 backdrop-blur">
        <Logo name={settings.site.name} />
        <DropdownMenu>
          <DropdownMenuTrigger className="grid size-10 place-items-center rounded-full hover:bg-accent" aria-label="Menu">
            <Menu className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onClick={download} disabled={downloading} className="items-start gap-2.5 py-2">
              {downloading ? <Spinner className="mt-0.5" /> : <Download className="mt-0.5" />}
              <span>
                <span className="block font-medium">Download your information</span>
                <span className="block text-xs text-muted-foreground">Your profile and all your posts (.json)</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={signOut}>
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        {q.isLoading || !s ? (
          <div className="grid place-items-center py-20"><Spinner className="size-6" /></div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border bg-card p-6 text-center">
              <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-destructive/10 text-destructive">
                <ShieldAlert className="size-8" />
              </div>
              <h1 className="text-2xl font-bold">Your account has been suspended</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                @{s.user.username}, your account broke our{" "}
                <Link href="/guidelines" className="font-medium text-foreground underline underline-offset-2">Community Guidelines</Link>. While it&apos;s
                suspended, you can&apos;t post, comment, message or browse.
              </p>

              <dl className="mt-5 grid gap-2 rounded-xl bg-muted/60 p-4 text-left text-sm">
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 text-muted-foreground">Reason</dt>
                  <dd className="font-medium break-words">{s.reason || "Violation of the Community Guidelines"}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 text-muted-foreground">Duration</dt>
                  <dd className="font-medium">
                    {s.until ? <>Until {format(new Date(s.until), "PPP 'at' p")}</> : "Permanent"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Review request */}
            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Request a review</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Think we made a mistake? Tell us what happened and our team will take another look.
              </p>

              {last && (
                <div
                  className={cn(
                    "mt-4 rounded-xl border p-4 text-sm",
                    last.status === "pending" && "border-amber-500/30 bg-amber-500/5",
                    last.status === "rejected" && "border-destructive/30 bg-destructive/5",
                    last.status === "approved" && "border-emerald-500/30 bg-emerald-500/5",
                  )}
                >
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    {last.status === "pending" && <><Clock className="size-4 text-amber-500" /> Under review</>}
                    {last.status === "rejected" && <><XCircle className="size-4 text-destructive" /> Review declined</>}
                    {last.status === "approved" && <><CheckCircle2 className="size-4 text-emerald-500" /> Approved</>}
                    <span className="ml-auto text-xs font-normal text-muted-foreground">sent <TimeAgo date={last.createdAt} /> ago</span>
                  </div>
                  <p className="whitespace-pre-wrap text-muted-foreground">&ldquo;{last.message}&rdquo;</p>
                  {last.response && (
                    <p className="mt-3 border-t pt-3"><span className="font-medium">Our team: </span>{last.response}</p>
                  )}
                  {last.status === "pending" && <p className="mt-3 text-xs text-muted-foreground">We&apos;ll update this page when there&apos;s a decision.</p>}
                </div>
              )}

              {showForm ? (
                <div className="mt-4 space-y-3">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={2000}
                    placeholder="Explain why you think your account should be restored…"
                    className="min-h-32"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs tabular-nums text-muted-foreground">{message.length}/2000</span>
                    <Button onClick={() => appeal.mutate()} disabled={appeal.isPending || message.trim().length < 10}>
                      {appeal.isPending && <Spinner />} Request review
                    </Button>
                  </div>
                </div>
              ) : (
                s.nextAppealAt && (
                  <p className="mt-4 text-sm text-muted-foreground">You can request another review on {format(new Date(s.nextAppealAt), "PPP")}.</p>
                )
              )}
            </section>

            <p className="text-center text-xs text-muted-foreground">
              Use the <Menu className="inline size-3.5" /> menu to download your information or log out.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
