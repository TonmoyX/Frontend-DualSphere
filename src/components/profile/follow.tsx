"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Lock, UserMinus, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { EmptyState, Spinner, UserAvatar, VerifiedMark } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { del, errorMessage, get, post } from "@/lib/api";
import type { FollowUser } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

function useFollowMutation(username: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => (on ? post(`/users/${username}/follow`) : del(`/users/${username}/follow`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["follows"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** Follow / Following button. "Following" opens a menu to unfollow — works for friends too, without unfriending. */
export function FollowButton({ username, name, isFollowing, isFriend }: { username: string; name: string; isFollowing: boolean; isFriend: boolean }) {
  const m = useFollowMutation(username);
  const first = name.split(" ")[0];

  if (!isFollowing) {
    return (
      <Button size="sm" variant="secondary" disabled={m.isPending} onClick={() => m.mutate(true, { onSuccess: () => toast.success(`You're following ${first}`) })}>
        {m.isPending ? <Spinner /> : <UserPlus />} Follow
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary" disabled={m.isPending}>
          {m.isPending ? <Spinner /> : <Check />} Following <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          onSelect={() =>
            m.mutate(false, {
              onSuccess: () => toast.success(isFriend ? `Unfollowed ${first}. You're still friends.` : `Unfollowed ${first}`),
            })
          }
        >
          <UserMinus />
          <span className="flex flex-col">
            <span>Unfollow</span>
            {isFriend && <span className="text-xs text-muted-foreground">Stay friends, but stop following {first}</span>}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowFollow({ u }: { u: FollowUser }) {
  const { user: me } = useAuth();
  const m = useFollowMutation(u.username);
  if (!me || u.isMe) return null;
  return (
    <Button size="xs" variant={u.viewerFollows ? "secondary" : "default"} disabled={m.isPending} onClick={() => m.mutate(!u.viewerFollows)}>
      {m.isPending ? <Spinner /> : u.viewerFollows ? <Check /> : <UserPlus />} {u.viewerFollows ? "Following" : "Follow"}
    </Button>
  );
}

/** Followers / Following list for a profile. */
export function FollowListDialog({ username, kind, onClose }: { username: string; kind: "followers" | "following" | null; onClose: () => void }) {
  const { user: me } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["follows", username.toLowerCase(), kind, me?.id ?? "anon"],
    queryFn: () => get<{ locked: boolean; users: FollowUser[] }>(`/users/${username}/${kind}`),
    enabled: !!kind,
  });

  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === "followers" ? "Followers" : "Following"}</DialogTitle>
        </DialogHeader>
        <div className="-mx-2 max-h-[60vh] overflow-y-auto">
          {isLoading && <div className="grid place-items-center py-8"><Spinner className="size-5" /></div>}
          {data?.locked && <EmptyState icon={<Lock className="size-8" />} title="This list is private" />}
          {data && !data.locked && data.users.length === 0 && (
            <EmptyState icon={<Users className="size-8" />} title={kind === "followers" ? "No followers yet" : "Not following anyone yet"} />
          )}
          <ul>
            {data?.users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50">
                <Link href={`/profile/${u.username}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar src={u.avatarUrl} name={u.displayName} className="size-11" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 truncate font-semibold">{u.displayName} {u.isVerified && <VerifiedMark />}</span>
                    <span className="block truncate text-sm text-muted-foreground">@{u.username}</span>
                  </span>
                </Link>
                <RowFollow u={u} />
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
