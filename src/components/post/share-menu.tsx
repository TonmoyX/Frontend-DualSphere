"use client";

import { useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Link2, MessageCircle, PenLine, Search, Send, UserRound, VenetianMask, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AnonAvatar, compact, Spinner, UserAvatar } from "@/components/common/bits";
import { ConversationAvatar } from "@/components/messages/chat-avatar";
import { conversationName } from "@/components/messages/dm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { errorMessage, get, post as apiPost } from "@/lib/api";
import type { Conversation, FeedPage, Post, Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useSettings } from "@/providers/settings-provider";
import { SharedPostPreview } from "./shared-post";

const postUrl = (id: string) => `${window.location.origin}/post/${id}`;

/** Put a freshly created post at the top of the matching feeds (the socket echo is de-duplicated by id). */
export function prependPost(qc: QueryClient, p: Post, username?: string) {
  for (const key of [["feed", "all"], ["feed", p.visibility]]) {
    qc.setQueryData<InfiniteData<FeedPage>>(key, (d) =>
      d ? { ...d, pages: [{ ...d.pages[0], posts: [p, ...d.pages[0].posts.filter((x) => x.id !== p.id)] }, ...d.pages.slice(1)] } : d,
    );
  }
  if (p.visibility === "identity" && username) qc.invalidateQueries({ queryKey: ["profile-posts", username] });
}

/** Share button: Share now · Share with a caption · Send in Messages · Copy link. */
export function ShareButton({ post }: { post: Post }) {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  // A share always re-shares the original, so the link and preview point at it
  const target = post.isShare ? post.sharedPost : post;
  const canShare = !!post.canShare && !!target;

  const quick = useMutation({
    mutationFn: () => apiPost<{ post: Post }>(`/posts/${post.id}/share`, { mode: "identity" }),
    onSuccess: ({ post: p }) => {
      prependPost(qc, p, user?.username);
      toast.success("Shared to your feed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!target) return null; // original was deleted — nothing to share

  const needUser = (fn: () => void) => () => (user ? fn() : router.push("/login"));
  const count = target.sharesCount ?? 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 outline-none transition-colors hover:bg-emerald-500/10 hover:text-emerald-500 data-[state=open]:bg-emerald-500/10 data-[state=open]:text-emerald-500"
          aria-label="Share"
        >
          <Send className="size-4" />
          {count > 0 && <span className="tabular-nums">{compact(count)}</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {canShare ? (
            <>
              <DropdownMenuItem onClick={needUser(() => quick.mutate())} disabled={quick.isPending} className="gap-3 py-2">
                <Zap /> <span className="flex-1"><span className="block font-medium">Share now</span><span className="block text-xs text-muted-foreground">Post to your feed as yourself</span></span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={needUser(() => setComposeOpen(true))} className="gap-3 py-2">
                <PenLine /> <span className="flex-1"><span className="block font-medium">Share to feed</span><span className="block text-xs text-muted-foreground">Add a caption, share as you or anonymously</span></span>
              </DropdownMenuItem>
            </>
          ) : (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              {target.sharePolicy === "friends" ? "Only the author's friends can share this post." : "The author turned off sharing for this post."}
            </p>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={needUser(() => setSendOpen(true))} className="gap-3 py-2">
            <MessageCircle /> <span className="font-medium">Send in Messages</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => { navigator.clipboard.writeText(postUrl(target.id)); toast.success("Link copied"); }}
            className="gap-3 py-2"
          >
            <Link2 /> <span className="font-medium">Copy link</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {composeOpen && <ShareDialog post={post} target={target} open={composeOpen} onOpenChange={setComposeOpen} />}
      {sendOpen && <SendLinkDialog url={postUrl(target.id)} open={sendOpen} onOpenChange={setSendOpen} />}
    </>
  );
}

/** "Share to feed" with a caption and identity/anonymous choice. */
function ShareDialog({ post, target, open, onOpenChange }: { post: Post; target: Post; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const { features } = useSettings();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<Visibility>("identity");
  const anonAllowed = features.anonymousPostingEnabled && !!user?.canPostAnonymously;
  const anon = mode === "anonymous" && anonAllowed;

  const share = useMutation({
    mutationFn: () => apiPost<{ post: Post }>(`/posts/${post.id}/share`, { content, mode: anon ? "anonymous" : "identity" }),
    onSuccess: ({ post: p }) => {
      prependPost(qc, p, user?.username);
      toast.success(anon ? "Shared anonymously 🎭" : "Shared to your feed");
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-center font-sans text-lg font-bold tracking-normal">Share</DialogTitle>
          <DialogDescription className="sr-only">Share this post to your feed</DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92dvh-8rem)] overflow-y-auto p-4">
          <div className="flex items-center gap-3">
            {anon ? <AnonAvatar className="size-11" /> : <UserAvatar src={user.avatarUrl} name={user.displayName} className="size-11" />}
            <div className="min-w-0">
              <p className={cn("truncate font-semibold", anon && "text-anon")}>{anon ? "Anonymous" : user.displayName}</p>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    "mt-0.5 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold transition-colors",
                    anon ? "bg-anon/15 text-anon hover:bg-anon/25" : "bg-muted hover:bg-accent",
                  )}
                >
                  {anon ? <VenetianMask className="size-3.5" /> : <UserRound className="size-3.5" />}
                  {anon ? "Anonymous" : "Identity"} <ChevronDown className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuItem onClick={() => setMode("identity")}><UserRound /> <span className="flex-1">Identity</span>{!anon && <Check className="text-primary" />}</DropdownMenuItem>
                  <DropdownMenuItem disabled={!anonAllowed} onClick={() => setMode("anonymous")}><VenetianMask /> <span className="flex-1">Anonymous</span>{anon && <Check className="text-primary" />}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!share.isPending) share.mutate(); } }}
            placeholder="Say something about this…"
            rows={3}
            maxLength={5000}
            className="mt-3 w-full resize-none bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
          />
          <SharedPostPreview post={target} />
        </div>
        <div className="border-t p-3">
          <Button className="w-full" disabled={share.isPending} onClick={() => share.mutate()}>
            {share.isPending && <Spinner />} Share now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Send a post/profile link to one or more chats (it shows up there as a rich preview card). */
export function SendLinkDialog({ url, open, onOpenChange, title = "Send in Messages" }: { url: string; open: boolean; onOpenChange: (o: boolean) => void; title?: string }) {
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const { data, isLoading } = useQuery({
    queryKey: ["dm", "forward-targets"],
    queryFn: async () => (await get<{ conversations: Conversation[] }>("/conversations?folder=primary")).conversations,
  });
  const list = (data ?? []).filter((c) => !c.blockedByMe && !c.blockedMe && conversationName(c).toLowerCase().includes(q.toLowerCase()));

  const send = useMutation({
    mutationFn: async () => {
      const content = note.trim() ? `${note.trim()}\n${url}` : url;
      const results = await Promise.allSettled(picked.map((id) => apiPost(`/conversations/${id}/messages`, { content })));
      const okCount = results.filter((r) => r.status === "fulfilled").length;
      if (!okCount) throw (results[0] as PromiseRejectedResult).reason;
      return okCount;
    },
    onSuccess: (n) => {
      toast.success(n === 1 ? "Sent" : `Sent to ${n} chats`);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="font-sans text-base tracking-normal">{title}</DialogTitle>
          <DialogDescription className="sr-only">Pick chats to send this post to</DialogDescription>
        </DialogHeader>
        <div className="border-b px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 w-full rounded-full bg-muted pr-3 pl-9 text-sm outline-none" />
          </div>
        </div>
        <div className="h-72 overflow-y-auto py-1">
          {isLoading && <Spinner className="mx-auto my-6 block" />}
          {!isLoading && list.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No chats found.</p>}
          {list.map((c) => {
            const on = picked.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent/60"
              >
                <ConversationAvatar c={c} size={44} />
                <span className="min-w-0 flex-1 truncate font-medium">{conversationName(c)}</span>
                <span className={cn("grid size-5 place-items-center rounded-full border-2", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                  {on && <Check className="size-3" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="space-y-2 border-t p-3">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write a message (optional)" maxLength={1000} className="h-9 w-full rounded-lg bg-muted px-3 text-sm outline-none" />
          <Button className="w-full" disabled={!picked.length || send.isPending} onClick={() => send.mutate()}>
            {send.isPending && <Spinner />} {picked.length > 1 ? `Send to ${picked.length} chats` : "Send"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
