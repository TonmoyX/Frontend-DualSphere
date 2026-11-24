"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, post } from "@/lib/api";
import { cn } from "@/lib/utils";

const REASONS = [
  { v: "spam", label: "Spam", desc: "Ads, scams or repetitive content" },
  { v: "harassment", label: "Harassment", desc: "Bullying, threats or hate" },
  { v: "misinformation", label: "Misinformation", desc: "Deliberately false or misleading" },
  { v: "illegal", label: "Illegal content", desc: "Breaks the law" },
  { v: "other", label: "Other", desc: "Something else" },
] as const;

export function ReportDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: { type: "post" | "comment" | "message" | "user"; id: string }; // user → id is the username
}) {
  const [reason, setReason] = useState<(typeof REASONS)[number]["v"]>("spam");
  const [details, setDetails] = useState("");
  const m = useMutation({
    mutationFn: () =>
      post(
        target.type === "post" ? `/posts/${target.id}/report` : target.type === "user" ? `/users/${encodeURIComponent(target.id)}/report` : target.type === "message" ? `/messages/${target.id}/report` : `/comments/${target.id}/report`,
        { reason, details: details || undefined },
      ),
    onSuccess: () => {
      toast.success("Report sent. Thanks for keeping DualSphere safe.");
      onOpenChange(false);
      setDetails("");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {target.type === "user" ? "profile" : target.type}</DialogTitle>
          <DialogDescription>
            {target.type === "message"
              ? "Moderators see only this message. The sender won't know you reported it."
              : "Moderators review every report. Reporting is confidential."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {REASONS.map((r) => (
            <button
              key={r.v}
              type="button"
              onClick={() => setReason(r.v)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors",
                reason === r.v ? "border-primary/50 bg-primary/10" : "hover:bg-accent",
              )}
            >
              <div className="text-sm font-medium">{r.label}</div>
              <div className="text-xs text-muted-foreground">{r.desc}</div>
            </button>
          ))}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="report-details">Details (optional)</Label>
          <Textarea id="report-details" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Anything that helps moderators" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending && <Spinner />} Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
