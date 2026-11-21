"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, post } from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { v: "bug", label: "Something isn't working" },
  { v: "account", label: "Account or login" },
  { v: "safety", label: "Safety or abuse" },
  { v: "idea", label: "Idea or feedback" },
  { v: "other", label: "Something else" },
] as const;

/** "Report a problem" (⌘B) — goes to the admin panel's Feedback inbox. */
export function ReportProblemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["v"]>("bug");
  const [message, setMessage] = useState("");
  const m = useMutation({
    mutationFn: () => post("/feedback", { category, message, pageUrl: window.location.pathname }),
    onSuccess: () => {
      toast.success("Thanks! Your report was sent to the DualSphere team.");
      setMessage("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription>Tell us what happened. To report a post, comment or message, use its ⋯ menu instead.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.v}
              type="button"
              onClick={() => setCategory(c.v)}
              className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", category === c.v ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent")}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Textarea
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          placeholder="Please include as much detail as possible — what you were doing, what you expected, and what happened instead."
          className="min-h-32"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={message.trim().length < 5 || m.isPending}>{m.isPending && <Spinner />} Send</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
