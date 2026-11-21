"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, CornerDownRight, Flag, Heart, MoreHorizontal, SendHorizontal, Smile, Trash2, UserRound, VenetianMask, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AnonAvatar, RoleBadge, Spinner, UserAvatar, VerifiedMark } from "@/components/common/bits";
import { AnimatedEmoji, EMOJI_PICKER } from "@/components/messages/animated-emoji";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { del, errorMessage, get, post } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Comment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useSettings } from "@/providers/settings-provider";
import { ReportDialog } from "./report-dialog";

type Node = Comment & { children: Node[] };
type Sort = "relevant" | "newest";

/** Lets a post's comment button focus the composer when the comments are already open. */
export const FOCUS_COMPOSER_EVENT = "ds:focus-comment-composer";

function buildTree(list: Comment[], sort: Sort): Node[] {
  const map = new Map<string, Node>();
  list.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: Node[] = [];
  map.forEach((n) => (n.parentId && map.get(n.parentId) ? map.get(n.parentId)!.children.push(n) : roots.push(n)));
  const byTime = (a: Node, b: Node) => +new Date(a.createdAt) - +new Date(b.createdAt);
  map.forEach((n) => n.children.sort(byTime)); // replies always oldest → newest
  return sort === "newest"
    ? roots.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    : roots.sort((a, b) => b.likesCount + b.children.length * 0.5 - (a.likesCount + a.children.length * 0.5) || byTime(a, b));
}

const countAll = (n: Node): number => n.children.reduce((s, c) => s + 1 + countAll(c), 0);
const descendants = (n: Node): string[] => n.children.flatMap((c) => [c.id, ...descendants(c)]);
const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso)).replace(/ (\w)\w*$/, "$1").replace(" ", "");

function CommentItem({ node, postId, depth, onReply }: { node: Node; postId: string; depth: number; onReply: (c: Comment) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const patch = (fn: (c: Comment) => Comment) =>
    qc.setQueryData<{ comments: Comment[] }>(["comments", postId], (d) => (d ? { ...d, comments: d.comments.map((c) => (c.id === node.id ? fn(c) : c)) } : d));

  const like = useMutation({
    mutationFn: () => post<{ liked: boolean; likesCount: number }>(`/comments/${node.id}/like`),
    onMutate: () => patch((c) => ({ ...c, likedByMe: !c.likedByMe, likesCount: c.likesCount + (c.likedByMe ? -1 : 1) })),
    onSuccess: (r) => patch((c) => ({ ...c, likedByMe: r.liked, likesCount: r.likesCount })),
    onError: (e) => { patch((c) => ({ ...c, likedByMe: !c.likedByMe, likesCount: c.likesCount + (c.likedByMe ? -1 : 1) })); toast.error(errorMessage(e)); },
  });
  const remove = useMutation({
    mutationFn: () => del(`/comments/${node.id}`),
    onSuccess: () => {
      const gone = new Set([node.id, ...descendants(node)]);
      qc.setQueryData<{ comments: Comment[] }>(["comments", postId], (d) => (d ? { ...d, comments: d.comments.filter((c) => !gone.has(c.id)) } : d));
      toast.success("Comment deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const replies = countAll(node);
  const mine = !!user && (!!node.isMine || user.id === node.author?.id);
  const anonAuthor = !!node.isPostAuthor && !node.isRemoved;
  const size = depth === 0 ? "size-9" : "size-7";

  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
      <div className="group/c flex gap-2">
        {anonAuthor ? (
          <AnonAvatar className={cn(size, "shrink-0")} />
        ) : node.author ? (
          <Link href={`/profile/${node.author.username}`} className="shrink-0">
            <UserAvatar src={node.author.avatarUrl} name={node.author.displayName} className={cn(size, "text-[10px]")} />
          </Link>
        ) : (
          <div className={cn(size, "shrink-0 rounded-full bg-muted")} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <div className="relative max-w-full min-w-0 rounded-2xl bg-black/[0.05] px-3 py-2 dark:bg-white/[0.08]">
              {anonAuthor ? (
                <>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[13px] font-semibold text-anon">Anonymous</span>
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-anon/15 px-1.5 py-px text-[11px] font-semibold text-anon">
                      <VenetianMask className="size-3" /> Author
                    </span>
                  </div>
                  <p className="text-[15px] leading-snug break-words whitespace-pre-wrap">{node.content}</p>
                </>
              ) : node.isRemoved || !node.author ? (
                <p className="text-sm text-muted-foreground italic">This comment was deleted.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-1">
                    <Link href={`/profile/${node.author.username}`} className="text-[13px] font-semibold hover:underline">{node.author.displayName}</Link>
                    {node.author.isVerified && <VerifiedMark />}
                    <RoleBadge role={node.author.role} />
                  </div>
                  <p className="text-[15px] leading-snug break-words whitespace-pre-wrap">{node.content}</p>
                </>
              )}
              {node.likesCount > 0 && !node.isRemoved && (
                <span className="absolute -right-2 -bottom-2.5 flex items-center gap-0.5 rounded-full border bg-card px-1 py-0.5 text-[11px] text-muted-foreground shadow-sm">
                  <span className="grid size-4 place-items-center rounded-full bg-pink-500"><Heart className="size-2.5 fill-white text-white" /></span>
                  {node.likesCount}
                </span>
              )}
            </div>
            {!node.isRemoved && user && (
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover/c:opacity-100 hover:bg-accent data-[state=open]:opacity-100" aria-label="Comment options">
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-32">
                  {mine ? (
                    <DropdownMenuItem variant="destructive" onClick={() => remove.mutate()}><Trash2 /> Delete</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => setReporting(true)}><Flag /> Report</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {!node.isRemoved && (
            <div className="mt-1 flex items-center gap-3 pl-3 text-xs font-semibold text-muted-foreground">
              <span className="font-normal" title={new Date(node.createdAt).toLocaleString()}>{ago(node.createdAt)}</span>
              <button disabled={!user} onClick={() => like.mutate()} className={cn("hover:underline", node.likedByMe && "text-pink-500")}>Like</button>
              {user && <button onClick={() => onReply(node)} className="hover:underline">Reply</button>}
            </div>
          )}

          {replies > 0 && !open && (
            <button onClick={() => setOpen(true)} className="mt-1.5 flex items-center gap-1.5 pl-1 text-[13px] font-semibold text-muted-foreground hover:underline">
              <CornerDownRight className="size-4" /> View {replies} repl{replies === 1 ? "y" : "ies"}
            </button>
          )}
          {open && node.children.length > 0 && (
            <div className={cn("mt-2 space-y-3", depth < 2 ? "" : "-ml-9")}>
              {node.children.map((c) => (
                <CommentItem key={c.id} node={c} postId={postId} depth={depth + 1} onReply={onReply} />
              ))}
              <button onClick={() => setOpen(false)} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:underline">
                <ChevronDown className="size-3.5 rotate-180" /> Hide replies
              </button>
            </div>
          )}
        </div>
      </div>
      <ReportDialog open={reporting} onOpenChange={setReporting} target={{ type: "comment", id: node.id }} />
    </motion.div>
  );
}

/** Bottom-pinned composer: "Comment as Name" · emoji · send. */
function CommentComposer({ postId, replyTo, onCancelReply, anonAuthor = false }: { postId: string; replyTo: Comment | null; onCancelReply: () => void; anonAuthor?: boolean }) {
  const { user } = useAuth();
  const { limits, features } = useSettings();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  // On your own anonymous post you reply as "Anonymous · Author" by default (replying as yourself would reveal you)
  const [asAnon, setAsAnon] = useState(true);
  const anon = anonAuthor && asAnon;
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyTo) ta.current?.focus();
  }, [replyTo]);
  useEffect(() => {
    const focus = () => ta.current?.focus();
    window.addEventListener(FOCUS_COMPOSER_EVENT, focus);
    return () => window.removeEventListener(FOCUS_COMPOSER_EVENT, focus);
  }, []);
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const m = useMutation({
    mutationFn: () =>
      post<{ comment: Comment }>(`/posts/${postId}/comments`, {
        content: text,
        parentId: replyTo?.parentId ? replyTo.parentId : (replyTo?.id ?? null),
        ...(anon ? { asPostAuthor: true } : {}),
      }),
    onSuccess: ({ comment }) => {
      // Our copy carries isMine; it replaces the live broadcast copy if that arrived first
      qc.setQueryData<{ comments: Comment[] }>(["comments", postId], (d) =>
        d ? { ...d, comments: d.comments.some((c) => c.id === comment.id) ? d.comments.map((c) => (c.id === comment.id ? comment : c)) : [...d.comments, comment] } : d,
      );
      setText("");
      onCancelReply();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!features.commentsEnabled) return <p className="px-4 py-3 text-center text-sm text-muted-foreground">Comments are turned off.</p>;
  if (!user) {
    return (
      <p className="px-4 py-3 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-primary hover:underline">Log in</Link> to comment.
      </p>
    );
  }

  const send = () => text.trim() && !m.isPending && m.mutate();

  return (
    <div className="flex gap-2 px-3 py-3 sm:px-4">
      {anon ? <AnonAvatar className="mt-0.5 size-9 shrink-0" /> : <UserAvatar src={user.avatarUrl} name={user.displayName} className="mt-0.5 size-9 shrink-0 text-[10px]" />}
      <div className="min-w-0 flex-1 rounded-2xl bg-black/[0.05] dark:bg-white/[0.08]">
        {anonAuthor && (
          <div className="flex items-center gap-1.5 px-3 pt-2 text-xs text-muted-foreground">
            Commenting as
            <DropdownMenu>
              <DropdownMenuTrigger className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold", anon ? "bg-anon/15 text-anon" : "bg-muted text-foreground")}>
                {anon ? <><VenetianMask className="size-3.5" /> Anonymous · Author</> : <><UserRound className="size-3.5" /> {user.displayName}</>}
                <ChevronDown className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem onClick={() => setAsAnon(true)} className="items-start gap-2.5 py-2">
                  <VenetianMask className="mt-0.5 text-anon" />
                  <span className="flex-1"><span className="block font-medium">Anonymous · Author</span><span className="block text-xs text-muted-foreground">Nobody can tell it&apos;s you</span></span>
                  {anon && <Check className="mt-0.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAsAnon(false)} className="items-start gap-2.5 py-2">
                  <UserRound className="mt-0.5" />
                  <span className="flex-1"><span className="block font-medium">{user.displayName}</span><span className="block text-xs text-muted-foreground">Shows your name — people may guess you wrote the post</span></span>
                  {!anon && <Check className="mt-0.5 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        {replyTo && (
          <div className="flex items-center gap-1 px-3 pt-2 text-xs text-muted-foreground">
            Replying to <b className="font-semibold text-foreground">{replyTo.author?.displayName ?? (replyTo.isPostAuthor ? "Anonymous" : "")}</b>
            <button onClick={onCancelReply} className="ml-auto rounded-full p-0.5 hover:bg-accent" aria-label="Cancel reply"><X className="size-3.5" /></button>
          </div>
        )}
        <div className="flex items-end gap-1 pr-1.5">
        <textarea
          ref={ta}
          rows={1}
          value={text}
          maxLength={limits.maxCommentLength}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
            if (e.key === "Escape" && replyTo) onCancelReply();
          }}
          enterKeyHint="send"
          placeholder={replyTo ? `Reply to ${replyTo.author?.displayName.split(" ")[0] ?? (replyTo.isPostAuthor ? "Anonymous" : "")}…` : anon ? "Comment as Anonymous…" : `Comment as ${user.displayName}`}
          aria-label="Write a comment"
          className="block max-h-36 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-3 pl-4 text-[15px] leading-5 outline-none placeholder:text-muted-foreground"
        />
          <Popover>
            <PopoverTrigger className="mb-1.5 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-amber-500" aria-label="Emoji">
              <Smile className="size-5" />
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-[300px] p-2">
              <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
                {EMOJI_PICKER.map((e) => (
                  <button key={e} onClick={() => { setText((t) => t + e); ta.current?.focus(); }} className="grid aspect-square place-items-center rounded-lg hover:bg-accent" aria-label={e}>
                    <AnimatedEmoji emoji={e} size={26} />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <button
            onClick={send}
            disabled={!text.trim() || m.isPending}
            className={cn(
              "mb-1 grid size-9 shrink-0 place-items-center rounded-full transition-all",
              text.trim() ? "scale-100 bg-primary text-primary-foreground shadow-md shadow-primary/30 hover:scale-105" : "text-muted-foreground",
            )}
            aria-label="Send comment"
          >
            {m.isPending ? <Spinner /> : <SendHorizontal className="size-[18px]" />}
          </button>
        </div>
        {text.length > limits.maxCommentLength * 0.8 && <p className="px-4 pb-1.5 text-right font-mono text-[11px] text-muted-foreground">{text.length}/{limits.maxCommentLength}</p>}
      </div>
    </div>
  );
}

/**
 * Facebook-style comments panel: scrollable [header (the post) + comments], composer pinned at the bottom.
 * Used by the post modal and the post page.
 */
/** `anonAuthor`: you are the author of this anonymous post → you may reply as "Anonymous · Author". */
export function CommentsPanel({ postId, header, className, anonAuthor = false }: { postId: string; header?: ReactNode; className?: string; anonAuthor?: boolean }) {
  const qc = useQueryClient();
  const [sort, setSort] = useState<Sort>("relevant");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => get<{ comments: Comment[]; hasMore: boolean }>(`/posts/${postId}/comments`),
  });

  // Live comments for everyone viewing this post
  useEffect(() => {
    const s = getSocket();
    s.emit("post:watch", postId);
    const onNew = (c: Comment) =>
      c.postId === postId &&
      qc.setQueryData<{ comments: Comment[] }>(["comments", postId], (d) => (d && !d.comments.some((x) => x.id === c.id) ? { ...d, comments: [...d.comments, c] } : d));
    const onRemoved = ({ id }: { id: string }) =>
      qc.setQueryData<{ comments: Comment[] }>(["comments", postId], (d) => (d ? { ...d, comments: d.comments.map((c) => (c.id === id ? { ...c, isRemoved: true, author: null, content: "" } : c)) } : d));
    const onDeleted = ({ ids }: { ids: string[] }) => {
      const gone = new Set(ids);
      qc.setQueryData<{ comments: Comment[] }>(["comments", postId], (d) => (d ? { ...d, comments: d.comments.filter((c) => !gone.has(c.id)) } : d));
    };
    s.on("comment:new", onNew);
    s.on("comment:removed", onRemoved);
    s.on("comment:deleted", onDeleted);
    return () => {
      s.emit("post:unwatch", postId);
      s.off("comment:new", onNew);
      s.off("comment:removed", onRemoved);
      s.off("comment:deleted", onDeleted);
    };
  }, [postId, qc]);

  const tree = useMemo(() => buildTree(data?.comments ?? [], sort), [data, sort]);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {header}
        <div className="px-3 pt-3 pb-4 sm:px-4">
          {tree.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="mb-3 flex items-center gap-1 text-[15px] font-semibold text-muted-foreground hover:text-foreground">
                {sort === "relevant" ? "Most relevant" : "Newest"} <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem onClick={() => setSort("relevant")} className="flex-col items-start gap-0">
                  <span className="font-medium">Most relevant</span>
                  <span className="text-xs text-muted-foreground">Comments with the most engagement first</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("newest")} className="flex-col items-start gap-0">
                  <span className="font-medium">Newest</span>
                  <span className="text-xs text-muted-foreground">Most recent comments first</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isLoading && <Spinner className="mx-auto my-6 block size-5 text-muted-foreground" />}
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {tree.map((n) => <CommentItem key={n.id} node={n} postId={postId} depth={0} onReply={setReplyTo} />)}
            </AnimatePresence>
          </div>
          {data && tree.length === 0 && (
            <div className="py-8 text-center">
              <p className="font-semibold">No comments yet</p>
              <p className="text-sm text-muted-foreground">Be the first to comment.</p>
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 border-t bg-card">
        <CommentComposer postId={postId} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} anonAuthor={anonAuthor} />
      </div>
    </div>
  );
}

/** Back-compat: inline usage (post page) — same panel without a fixed height. */
export function CommentThread({ postId }: { postId: string }) {
  return <CommentsPanel postId={postId} />;
}
