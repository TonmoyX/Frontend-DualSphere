"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, post } from "@/lib/api";

/**
 * Set by a community page so post cards know when the viewer moderates *this* community.
 * It only controls which buttons show — the API re-checks the role on every action.
 */
export const CommunityPageContext = createContext<{ slug: string; canModerate: boolean } | null>(null);
export const useCommunityPage = () => useContext(CommunityPageContext);

/** Community mods: remove a post from the community, with a reason the author sees. */
export function CommunityRemoveDialog({ slug, postId, open, onOpenChange }: { slug: string; postId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => post(`/communities/${slug}/posts/${postId}/remove`, { reason }),
    onSuccess: () => {
      toast.success("Post removed from the community");
      qc.invalidateQueries({ queryKey: ["community-posts", slug] });
      setReason("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !m.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove post</DialogTitle>
          <DialogDescription>The post is hidden from the community. If it was posted with a name, the author is told why.</DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Reason (e.g. breaks rule 2: no spam)" className="min-h-24" />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={m.isPending}>Cancel</Button>
          <Button variant="destructive" onClick={() => m.mutate()} disabled={m.isPending || reason.trim().length < 3}>
            {m.isPending && <Spinner />} Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
