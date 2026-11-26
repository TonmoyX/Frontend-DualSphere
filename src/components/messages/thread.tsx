"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, BellOff, BellRing, ChevronDown, ChevronLeft, ChevronUp, Info, MoreVertical, Phone, Pin, PinOff, Search, Trash2, User, Video, X } from "lucide-react";
import { useCall } from "@/components/calls/call-provider";
import { useGroupCall } from "@/components/calls/group-call";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner, VerifiedMark } from "@/components/common/bits";
import { ReportDialog } from "@/components/post/report-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { del, errorMessage, get, patch, post, put } from "@/lib/api";
import type { ChatMessage, Conversation, MessagePage } from "@/lib/types";
import type { UploadedMedia } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { ConversationAvatar } from "./chat-avatar";
import { Composer } from "./composer";
import { ConversationInfo } from "./conversation-info";
import { appendMessage, conversationName, dmKeys, patchConversation, patchMessage, presenceText, removeMessage, useTyping } from "./dm";
import { MessageBubble, type GroupPos, type Receipt } from "./message-bubble";
import { DeleteMessageDialog, ForwardDialog } from "./message-dialogs";

const GROUP_GAP = 5 * 60_000;
const EDIT_WINDOW = 48 * 3600_000;

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return d.getFullYear() === new Date().getFullYear() ? format(d, "d MMMM") : format(d, "d MMMM yyyy");
}
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

type SendPayload = { content?: string; mediaIds?: string[]; heart?: boolean; media?: UploadedMedia[]; replyTo?: ChatMessage | null; voiceDuration?: number; anonymous?: boolean };

export function Thread({ id }: { id: string }) {
  const { user } = useAuth();
  const myId = user!.id;
  const qc = useQueryClient();
  const router = useRouter();
  const { startCall, busy: oneToOneBusy } = useCall();
  const groupCall = useGroupCall();
  const inCall = oneToOneBusy || !!groupCall.active;
  // Group chats: send as yourself or anonymously (remembered per chat while the page is open)
  const [anonMode, setAnonMode] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const prevHeight = useRef<number | null>(null);
  const stickToBottom = useRef(true);
  const retryMap = useRef(new Map<string, SendPayload>());
  const [atBottom, setAtBottom] = useState(true);
  const [newWhileUp, setNewWhileUp] = useState(0);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hit, setHit] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const convQ = useQuery({
    queryKey: dmKeys.conv(id),
    queryFn: async () => (await get<{ conversation: Conversation }>(`/conversations/${id}`)).conversation,
  });
  const msgsQ = useInfiniteQuery({
    queryKey: dmKeys.msgs(id),
    queryFn: ({ pageParam }) => get<MessagePage>(`/conversations/${id}/messages${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ""}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.cursor : null),
  });
  const searchQ = useQuery({
    queryKey: ["dm", "search", id, q.trim()],
    queryFn: async () => (await get<{ messages: ChatMessage[] }>(`/conversations/${id}/search?q=${encodeURIComponent(q.trim())}`)).messages,
    enabled: searchOpen && q.trim().length > 0,
  });
  const c = convQ.data;
  // Is a group call running here? (kept live by gcall:state events)
  const isGroupChat = !!c?.isGroup;
  const { watch: watchGroupCall } = groupCall;
  useEffect(() => { if (isGroupChat) watchGroupCall(id); }, [id, isGroupChat, watchGroupCall]);
  const messages = useMemo(() => (msgsQ.data ? [...msgsQ.data.pages].reverse().flatMap((p) => p.messages) : []), [msgsQ.data]);
  const newest = messages.at(-1);
  const typers = useTyping(id);

  // Clock for the 48h edit window
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── scrolling ──
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, typers.length]);

  // count messages that arrive while scrolled up
  const lastSeenId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!newest || newest.id === lastSeenId.current) return;
    if (lastSeenId.current && !stickToBottom.current && newest.sender?.id !== myId) setNewWhileUp((n) => n + 1);
    lastSeenId.current = newest.id;
  }, [newest, myId]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = msgsQ;
  useEffect(() => {
    const el = topSentinel.current;
    const root = scroller.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hasNextPage && !isFetchingNextPage) {
        prevHeight.current = root.scrollHeight;
        fetchNextPage();
      }
    }, { root, rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const scrollToBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setNewWhileUp(0);
  };

  // ── read receipts ──
  useEffect(() => {
    if (!c || !newest || newest.pending) return;
    if (newest.sender?.id === myId && c.unreadCount === 0) return;
    const t = setTimeout(() => {
      post(`/conversations/${id}/read`).catch(() => {});
      patchConversation(qc, id, (x) => ({ ...x, unreadCount: 0 }));
    }, 300);
    return () => clearTimeout(t);
  }, [id, newest?.id, c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── jump to a message (loads older pages until found) ──
  const jumpTo = async (mid: string) => {
    for (let i = 0; i < 15; i++) {
      const el = document.getElementById(`msg-${mid}`);
      if (el) {
        stickToBottom.current = false;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlight(mid);
        setTimeout(() => setHighlight(null), 1600);
        return;
      }
      const r = await fetchNextPage();
      if (!r.hasNextPage && !document.getElementById(`msg-${mid}`)) break;
      await new Promise((res) => setTimeout(res, 50));
    }
    toast.info("That message is no longer available.");
  };

  // ── actions ──
  const send = (p: SendPayload) => {
    const clientId = crypto.randomUUID();
    const reply = p.replyTo === undefined ? replyTo : p.replyTo;
    const temp: ChatMessage = {
      id: `tmp-${clientId}`,
      clientId,
      pending: true,
      conversationId: id,
      kind: p.heart ? "heart" : p.mediaIds?.length ? "media" : "text",
      content: p.heart ? "❤️" : (p.content ?? ""),
      media: (p.media ?? []).map((m) => ({ id: m.id, url: m.url, type: m.kind, mime: m.mime, ...(p.voiceDuration ? { duration: p.voiceDuration } : {}) })),
      unsent: false,
      removed: false,
      anonymous: !!p.anonymous,
      sender: { id: myId, username: user!.username, displayName: user!.displayName, avatarUrl: user!.avatarUrl, isVerified: user!.isVerified },
      replyTo: reply
        ? { id: reply.id, senderId: reply.sender?.id ?? null, senderName: reply.sender?.displayName ?? null, kind: reply.kind, content: reply.content, hasMedia: reply.media.length > 0, unsent: reply.unsent }
        : null,
      reactions: [],
      editedAt: null,
      forwardedFrom: null,
      createdAt: new Date().toISOString(),
    };
    stickToBottom.current = true;
    retryMap.current.set(temp.id, { ...p, replyTo: reply });
    appendMessage(qc, id, temp);
    setReplyTo(null);
    post<{ message: ChatMessage }>(`/conversations/${id}/messages`, { content: p.content, mediaIds: p.mediaIds, heart: p.heart, replyToId: reply?.id ?? null, clientId, voiceDuration: p.voiceDuration, anonymous: p.anonymous || undefined })
      .then(({ message }) => {
        appendMessage(qc, id, message, clientId);
        retryMap.current.delete(temp.id);
        qc.invalidateQueries({ queryKey: ["dm", "list"] });
        if (c?.status === "pending") qc.invalidateQueries({ queryKey: dmKeys.conv(id) });
      })
      .catch((e) => {
        patchMessage(qc, id, temp.id, (m) => ({ ...m, pending: false, failed: true }));
        toast.error(errorMessage(e));
      });
  };

  const retry = (m: ChatMessage) => {
    const p = retryMap.current.get(m.id);
    removeMessage(qc, id, m.id);
    if (p) send(p);
  };

  const react = (m: ChatMessage, emoji: string | null) => {
    const before = m.reactions;
    patchMessage(qc, id, m.id, (x) => ({
      ...x,
      reactions: emoji ? [...x.reactions.filter((r) => r.userId !== myId), { emoji, userId: myId }] : x.reactions.filter((r) => r.userId !== myId),
    }));
    post(`/messages/${m.id}/react`, { emoji }).catch((e) => {
      patchMessage(qc, id, m.id, (x) => ({ ...x, reactions: before }));
      toast.error(errorMessage(e));
    });
  };

  const saveEdit = (m: ChatMessage, content: string) => {
    const before = m;
    patchMessage(qc, id, m.id, (x) => ({ ...x, content, editedAt: new Date().toISOString() }));
    patch<{ message: ChatMessage }>(`/messages/${m.id}`, { content })
      .then(({ message }) => patchMessage(qc, id, m.id, () => message))
      .catch((e) => { patchMessage(qc, id, m.id, () => before); toast.error(errorMessage(e)); });
  };

  const doDelete = (m: ChatMessage, scope: "me" | "everyone") => {
    setDeleting(null);
    removeMessage(qc, id, m.id); // both "for me" and "for everyone" leave no trace in the chat
    del(`/messages/${m.id}?scope=${scope}`)
      .then(() => qc.invalidateQueries({ queryKey: ["dm", "list"] }))
      .catch((e) => { toast.error(errorMessage(e)); qc.invalidateQueries({ queryKey: dmKeys.msgs(id) }); });
  };

  const togglePinMessage = (m: ChatMessage | null) =>
    put<{ conversation: Conversation }>(`/conversations/${id}/pin-message`, { messageId: m?.id ?? null })
      .then(({ conversation }) => { qc.setQueryData(dmKeys.conv(id), conversation); toast.success(m ? "Message pinned" : "Message unpinned"); })
      .catch((e) => toast.error(errorMessage(e)));

  const togglePinChat = () =>
    put<{ conversation: Conversation }>(`/conversations/${id}/pin`, { pinned: !c!.pinned })
      .then(({ conversation }) => { qc.setQueryData(dmKeys.conv(id), conversation); qc.invalidateQueries({ queryKey: ["dm", "list"] }); })
      .catch((e) => toast.error(errorMessage(e)));

  const toggleMute = () =>
    patch<{ conversation: Conversation }>(`/conversations/${id}`, { muted: !c!.muted })
      .then(({ conversation }) => { qc.setQueryData(dmKeys.conv(id), conversation); qc.invalidateQueries({ queryKey: ["dm", "list"] }); })
      .catch((e) => toast.error(errorMessage(e)));

  if (convQ.isError) {
    return (
      <div className="grid h-full place-items-center p-8 text-center text-sm text-muted-foreground">
        <div>
          <p className="mb-3">This conversation isn&apos;t available.</p>
          <Button asChild variant="outline" size="sm"><Link href="/messages">Back to messages</Link></Button>
        </div>
      </div>
    );
  }
  if (!c) return <div className="grid h-full place-items-center"><Spinner className="size-6 text-muted-foreground" /></div>;

  const name = conversationName(c);
  const other = !c.isGroup ? c.participants[0] : undefined;
  const typingNames = c.participants.filter((p) => typers.includes(p.id));
  const status = typingNames.length
    ? c.isGroup ? `${typingNames[0].displayName.split(" ")[0]} is typing…` : "typing…"
    : presenceText(c);

  // 1:1 calls — only when both sides can actually talk
  const canCall = !!other && !c.isGroup && c.status === "accepted" && !c.blockedByMe && !c.blockedMe && !other.deactivated;
  const call = (kind: "audio" | "video") => other && startCall(id, { id: other.id, displayName: other.displayName, avatarUrl: other.avatarUrl, username: other.username }, kind);

  // Group calls: anyone in the group can start one, or join the one already running
  const canGroupCall = c.isGroup && c.status === "accepted" && c.participants.length > 0;
  const groupCallHere = groupCall.calls[id] ?? null;
  const inThisGroupCall = groupCall.active?.conversationId === id;

  const receiptFor = (m: ChatMessage): Receipt => {
    if (m.sender?.id !== myId) return null;
    if (m.failed) return "failed";
    if (m.pending) return "pending";
    const read = c.participants.some((p) => p.lastReadAt && new Date(p.lastReadAt) >= new Date(m.createdAt));
    return read ? "read" : "sent";
  };
  const results = searchQ.data ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-card px-2 sm:px-4">
        <button onClick={() => router.push("/messages")} className="rounded-full p-1.5 hover:bg-accent md:hidden" aria-label="Back">
          <ChevronLeft className="size-6" />
        </button>
        {searchOpen ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => { setQ(e.target.value); setHit(0); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && results.length) { const i = Math.min(hit, results.length - 1); jumpTo(results[i].id); setHit((h) => Math.min(h + 1, results.length - 1)); }
                  if (e.key === "Escape") { setSearchOpen(false); setQ(""); }
                }}
                placeholder="Search in chat"
                className="h-10 w-full rounded-full bg-muted pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {q && <span className="text-xs whitespace-nowrap text-muted-foreground">{results.length ? `${Math.min(hit + 1, results.length)} of ${results.length}` : searchQ.isFetching ? "…" : "No results"}</span>}
            <button disabled={!results.length} onClick={() => { const i = Math.min(hit + 1, results.length - 1); setHit(i); jumpTo(results[i].id); }} className="rounded-full p-1.5 hover:bg-accent disabled:opacity-40" aria-label="Older result"><ChevronUp className="size-5" /></button>
            <button disabled={!results.length} onClick={() => { const i = Math.max(hit - 1, 0); setHit(i); jumpTo(results[i].id); }} className="rounded-full p-1.5 hover:bg-accent disabled:opacity-40" aria-label="Newer result"><ChevronDown className="size-5" /></button>
            <button onClick={() => { setSearchOpen(false); setQ(""); }} className="rounded-full p-1.5 hover:bg-accent" aria-label="Close search"><X className="size-5" /></button>
          </div>
        ) : (
          <>
            <button onClick={() => setInfoOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <ConversationAvatar c={c} size={42} />
              <div className="min-w-0">
                <div className="flex items-center gap-1 truncate font-semibold">{name} {other?.isVerified && <VerifiedMark />}</div>
                {status && (
                  <div className={cn("truncate text-[13px]", typingNames.length || status === "online" ? "text-primary" : "text-muted-foreground")}>{status}</div>
                )}
              </div>
            </button>
            {canCall && (
              <>
                <button onClick={() => call("audio")} disabled={inCall} className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40" aria-label="Voice call" title="Voice call">
                  <Phone className="size-5" />
                </button>
                <button onClick={() => call("video")} disabled={inCall} className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40" aria-label="Video call" title="Video call">
                  <Video className="size-5" />
                </button>
              </>
            )}
            {canGroupCall && !groupCallHere && (
              <>
                <button onClick={() => groupCall.start(id, name, "audio")} disabled={inCall} className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40" aria-label="Group voice call" title="Group voice call">
                  <Phone className="size-5" />
                </button>
                <button onClick={() => groupCall.start(id, name, "video")} disabled={inCall} className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40" aria-label="Group video call" title="Group video call">
                  <Video className="size-5" />
                </button>
              </>
            )}
            <button onClick={() => setSearchOpen(true)} className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Search in chat">
              <Search className="size-5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Chat menu">
                <MoreVertical className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {other && <DropdownMenuItem asChild><Link href={`/profile/${other.username}`}><User /> View profile</Link></DropdownMenuItem>}
                <DropdownMenuItem onClick={() => setInfoOpen(true)}><Info /> Chat info</DropdownMenuItem>
                <DropdownMenuItem onClick={togglePinChat}>{c.pinned ? <><PinOff /> Unpin chat</> : <><Pin /> Pin chat</>}</DropdownMenuItem>
                <DropdownMenuItem onClick={toggleMute}>{c.muted ? <><BellRing /> Unmute</> : <><BellOff /> Mute notifications</>}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setInfoOpen(true)}><Trash2 /> Delete chat…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </header>

      {/* Group call running in this chat → join banner */}
      {groupCallHere && !inThisGroupCall && (
        <div className="flex items-center gap-3 border-b bg-green-500/10 px-4 py-2 text-sm">
          <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-green-500" /></span>
          <span className="min-w-0 flex-1 truncate">
            <b className="font-semibold">{groupCallHere.kind === "video" ? "Video" : "Voice"} call in progress</b>
            <span className="text-muted-foreground"> · {groupCallHere.participants.map((p) => p.displayName.split(" ")[0]).join(", ")}</span>
          </span>
          <Button size="sm" className="h-8 rounded-full bg-green-600 hover:bg-green-700" disabled={inCall} onClick={() => groupCall.join(groupCallHere.callId, id, name, groupCallHere.kind)}>
            {groupCallHere.kind === "video" ? <Video /> : <Phone />} Join
          </Button>
        </div>
      )}

      {/* ── Pinned message bar ── */}
      {c.pinnedMessage && !searchOpen && (
        <div className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-1.5 sm:px-4">
          <button onClick={() => jumpTo(c.pinnedMessage!.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
            <span className="h-8 w-[3px] shrink-0 rounded-full bg-primary" />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-primary">Pinned message</span>
              <span className="block truncate text-[13px] text-muted-foreground">{c.pinnedMessage.preview}</span>
            </span>
          </button>
          <button onClick={() => togglePinMessage(null)} className="rounded-full p-1.5 text-muted-foreground hover:bg-accent" aria-label="Unpin message"><X className="size-4" /></button>
        </div>
      )}

      {/* ── Messages (wallpaper) ── */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          className="chat-wallpaper h-full overflow-y-auto px-2 pt-3 pb-2 sm:px-6"
          onScroll={(e) => {
            const el = e.currentTarget;
            const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            stickToBottom.current = bottom;
            if (bottom !== atBottom) setAtBottom(bottom);
            if (bottom && newWhileUp) setNewWhileUp(0);
          }}
        >
          <div ref={topSentinel} />
          {isFetchingNextPage && <Spinner className="mx-auto mb-3 block text-muted-foreground" />}

          {msgsQ.data && !hasNextPage && (
            <div className="mx-auto mb-6 flex w-fit max-w-xs flex-col items-center rounded-2xl bg-card/90 px-6 py-5 text-center shadow-sm backdrop-blur">
              <ConversationAvatar c={c} size={72} />
              <div className="mt-2 flex items-center gap-1 font-semibold">{name} {other?.isVerified && <VerifiedMark />}</div>
              {other && <div className="text-sm text-muted-foreground">@{other.username}</div>}
              {c.isGroup && <div className="text-sm text-muted-foreground">{c.memberCount} members</div>}
              {messages.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No messages here yet. Say hi! 👋</p>}
            </div>
          )}
          {msgsQ.isLoading && <Spinner className="mx-auto mt-10 block size-6 text-muted-foreground" />}

          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
            if (m.kind === "system") {
              return (
                <Fragment key={m.id}>
                  {newDay && <DayChip label={dayLabel(m.createdAt)} />}
                  <div className="my-2 flex justify-center"><span className="rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium text-foreground/70 dark:bg-white/10 dark:text-white/90">{m.content}</span></div>
                </Fragment>
              );
            }
            const same = (a?: ChatMessage, b?: ChatMessage) =>
              // Anonymous messages never group (two in a row may be from different people)
              !!a && !!b && a.kind !== "system" && b.kind !== "system" && !!a.sender && a.sender.id === b.sender?.id && !!a.anonymous === !!b.anonymous &&
              sameDay(a.createdAt, b.createdAt) && Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) < GROUP_GAP;
            const withPrev = same(prev, m) && !newDay;
            const withNext = same(m, next);
            const pos: GroupPos = withPrev && withNext ? "middle" : withPrev ? "last" : withNext ? "first" : "single";
            const mine = m.sender?.id === myId;
            const canEdit = mine && !m.unsent && !m.removed && !m.pending && (m.kind === "text" || m.kind === "media") && now - new Date(m.createdAt).getTime() < EDIT_WINDOW;
            return (
              <Fragment key={m.id}>
                {newDay && <DayChip label={dayLabel(m.createdAt)} />}
                <MessageBubble
                  m={m}
                  mine={mine}
                  pos={pos}
                  myId={myId}
                  receipt={receiptFor(m)}
                  pinned={c.pinnedMessage?.id === m.id}
                  canEdit={canEdit}
                  highlight={highlight === m.id}
                  showAvatar={!mine && c.isGroup && !withNext}
                  showName={c.isGroup && !mine && !withPrev}
                  onReact={(e) => react(m, e)}
                  onReply={() => { setEditing(null); setReplyTo(m); }}
                  onEdit={() => { setReplyTo(null); setEditing(m); }}
                  onForward={() => setForwarding(m)}
                  onPin={() => togglePinMessage(c.pinnedMessage?.id === m.id ? null : m)}
                  onDelete={() => setDeleting(m)}
                  onReport={() => setReporting(m.id)}
                  onRetry={() => retry(m)}
                  onJumpTo={jumpTo}
                  onCallBack={canCall && !inCall ? call : canGroupCall && !inCall && !groupCallHere ? (k) => groupCall.start(id, name, k) : undefined}
                />
              </Fragment>
            );
          })}

          <AnimatePresence>
            {typingNames.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-2 flex px-1">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-card px-4 py-3 shadow-sm" aria-label="typing">
                  {[0, 1, 2].map((d) => (
                    <motion.span key={d} className="size-2 rounded-full bg-muted-foreground/60" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Scroll-to-bottom with unread counter */}
        <AnimatePresence>
          {!atBottom && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={scrollToBottom}
              className="absolute right-4 bottom-4 grid size-11 place-items-center rounded-full border bg-card text-muted-foreground shadow-lg hover:text-foreground"
              aria-label="Scroll to latest"
            >
              <ArrowDown className="size-5" />
              {newWhileUp > 0 && (
                <span className="absolute -top-2 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">{newWhileUp}</span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer: request / blocked / composer ── */}
      {c.status === "pending" ? (
        <div className="border-t bg-card px-6 py-5 text-center">
          <p className="font-semibold">{name} wants to message you</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">You&apos;re not friends yet. If you accept, they&apos;ll be able to see when you&apos;ve read their messages.</p>
          <div className="mt-4 flex justify-center gap-2">
            {other && (
              <Button variant="ghost" className="text-destructive" onClick={() =>
                post(`/blocks/${other.id}`).then(() => del(`/conversations/${id}`)).then(() => { toast.success(`Blocked ${other.displayName}`); qc.invalidateQueries({ queryKey: ["dm"] }); router.push("/messages"); }).catch((e) => toast.error(errorMessage(e)))
              }>Block</Button>
            )}
            <Button variant="ghost" className="text-destructive" onClick={() =>
              del(`/conversations/${id}`).then(() => { qc.invalidateQueries({ queryKey: ["dm"] }); router.push("/messages"); }).catch((e) => toast.error(errorMessage(e)))
            }>Delete</Button>
            <Button onClick={() =>
              post<{ conversation: Conversation }>(`/conversations/${id}/accept`).then(({ conversation }) => {
                qc.setQueryData(dmKeys.conv(id), conversation);
                qc.invalidateQueries({ queryKey: ["dm", "list"] });
                qc.invalidateQueries({ queryKey: dmKeys.unread });
              }).catch((e) => toast.error(errorMessage(e)))
            }>Accept</Button>
          </div>
        </div>
      ) : c.blockedByMe ? (
        <div className="border-t bg-card p-5 text-center text-sm">
          You blocked {name}.{" "}
          <button className="font-semibold text-primary hover:underline" onClick={() => other && del(`/blocks/${other.id}`).then(() => qc.invalidateQueries({ queryKey: dmKeys.conv(id) })).catch((e) => toast.error(errorMessage(e)))}>Unblock</button>
        </div>
      ) : c.blockedMe || (other && other.deactivated) ? (
        <div className="border-t bg-card p-5 text-center text-sm text-muted-foreground">You can&apos;t reply to this conversation.</div>
      ) : c.isGroup && c.participants.length === 0 ? (
        <div className="border-t bg-card p-5 text-center text-sm text-muted-foreground">Everyone else has left this chat.</div>
      ) : (
        <Composer
          conversationId={id}
          isGroup={c.isGroup}
          anonymous={c.isGroup && anonMode}
          onToggleAnonymous={c.isGroup ? () => setAnonMode((v) => !v) : undefined}
          replyTo={replyTo}
          editing={editing}
          onCancel={() => { setReplyTo(null); setEditing(null); }}
          onSend={(p) => send({ ...p, anonymous: c.isGroup && anonMode })}
          onSaveEdit={saveEdit}
          myId={myId}
        />
      )}

      <ConversationInfo key={c.id + (c.title ?? "")} c={c} open={infoOpen} onOpenChange={setInfoOpen} />
      <DeleteMessageDialog
        key={deleting?.id ?? "none"}
        message={deleting}
        mine={deleting?.sender?.id === myId}
        conversation={c}
        onClose={() => setDeleting(null)}
        onConfirm={(scope) => deleting && doDelete(deleting, scope)}
      />
      <ForwardDialog message={forwarding} onClose={() => setForwarding(null)} />
      {reporting && <ReportDialog open onOpenChange={(o) => !o && setReporting(null)} target={{ type: "message", id: reporting }} />}
    </div>
  );
}

function DayChip({ label }: { label: string }) {
  return (
    <div className="sticky top-1 z-10 my-2 flex justify-center">
      <span className="rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium text-foreground/70 backdrop-blur dark:bg-white/10 dark:text-white/90">{label}</span>
    </div>
  );
}
