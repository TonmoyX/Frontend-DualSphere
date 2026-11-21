"use client";

import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { AlertCircle, Check, CheckCheck, ChevronDown, Clock3, Copy, Flag, Forward, Pencil, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Pin, PinOff, Reply, Trash2, Video } from "lucide-react";
import { VoicePlayer, formatDuration } from "./voice";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/common/bits";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/common/video-player";
import { firstInternalLink, LinkPreview } from "./link-preview";
import { AnimatedEmoji, QUICK_REACTIONS, emojiOnly } from "./animated-emoji";

export type GroupPos = "single" | "first" | "middle" | "last";
export type Receipt = "pending" | "sent" | "read" | "failed" | null;

interface Props {
  m: ChatMessage;
  mine: boolean;
  pos: GroupPos;
  showAvatar: boolean;
  showName: boolean;
  myId: string;
  receipt: Receipt;
  pinned: boolean;
  canEdit: boolean;
  highlight?: boolean;
  onReact: (emoji: string | null) => void;
  onReply: () => void;
  onEdit: () => void;
  onForward: () => void;
  onPin: () => void;
  onDelete: () => void;
  onReport: () => void;
  onRetry?: () => void;
  onJumpTo?: (id: string) => void;
  onCallBack?: (kind: "audio" | "video") => void;
}

/** Name colours for group chats (Telegram-like). */
const NAME_COLORS = ["text-rose-500", "text-amber-600", "text-emerald-600", "text-sky-600", "text-violet-600", "text-pink-500", "text-teal-600"];
const nameColor = (id: string) => NAME_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % NAME_COLORS.length];

function Ticks({ r, onMedia }: { r: Receipt; onMedia?: boolean }) {
  if (!r) return null;
  const cls = cn("size-[15px]", onMedia ? "text-white" : r === "read" ? "text-sky-300" : "opacity-80");
  if (r === "pending") return <Clock3 className="size-3 opacity-70" />;
  if (r === "failed") return <AlertCircle className="size-3.5 text-destructive" />;
  return r === "read" ? <CheckCheck className={cls} strokeWidth={2.4} /> : <Check className={cls} strokeWidth={2.4} />;
}

/** Bubble tail (Telegram), drawn on the last bubble of a group. */
function Tail({ mine }: { mine: boolean }) {
  return (
    <svg viewBox="0 0 11 20" width="11" height="20" className={cn("absolute bottom-0", mine ? "-right-[6px] text-primary" : "-left-[6px] -scale-x-100 text-card")} aria-hidden>
      <path d="M0 0 C0 12 4 18 11 20 L0 20 Z" fill="currentColor" />
    </svg>
  );
}

export function MessageBubble(p: Props) {
  const { m, mine, pos, myId } = p;
  const [menuOpen, setMenuOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myReaction = m.reactions.find((r) => r.userId === myId)?.emoji ?? null;
  const gone = m.unsent || m.removed;
  const isCall = m.kind === "call" && !!m.call;
  const isVoice = m.media.length === 1 && m.media[0].type === "audio";
  const bigEmoji = !gone && !isCall && !m.storyRef && m.media.length === 0 && (m.kind === "heart" ? ["❤️"] : emojiOnly(m.content));
  const last = pos === "last" || pos === "single";
  // Shared post/profile links get a rich preview card; a bare link shows as the card alone
  const link = !gone && !isCall && m.kind !== "heart" && m.content ? firstInternalLink(m.content) : null;
  const linkOnly = !!link && m.content.trim() === link.raw && m.media.length === 0 && !m.storyRef && !m.replyTo && !m.forwardedFrom;
  const time = format(new Date(m.createdAt), "HH:mm");

  const react = (e: string | null) => {
    p.onReact(e);
    if (e && e !== myReaction) setBurst((b) => b + 1);
  };

  // Right-click (desktop) or long-press (touch) opens the menu
  const menuHandlers = gone || m.pending
    ? {}
    : {
        onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setMenuOpen(true); },
        onTouchStart: () => { press.current = setTimeout(() => setMenuOpen(true), 450); },
        onTouchEnd: () => press.current && clearTimeout(press.current),
        onTouchMove: () => press.current && clearTimeout(press.current),
        onDoubleClick: () => react(myReaction === "❤️" ? null : "❤️"),
      };

  const grouped = Object.entries(m.reactions.reduce<Record<string, number>>((acc, r) => ((acc[r.emoji] = (acc[r.emoji] ?? 0) + 1), acc), {}));
  const reactionChips = grouped.length > 0 && (
    <div className="mt-1 flex flex-wrap gap-1">
      {grouped.map(([e, n]) => (
        <button
          key={e}
          onClick={(ev) => { ev.stopPropagation(); react(myReaction === e ? null : e); }}
          className={cn(
            "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium transition-colors",
            myReaction === e
              ? mine ? "bg-white/90 text-primary" : "bg-primary text-primary-foreground"
              : mine ? "bg-white/20 text-white" : "bg-primary/10 text-primary",
          )}
        >
          <AnimatedEmoji emoji={e} size={16} /> {n}
        </button>
      ))}
    </div>
  );

  const meta = (onMedia = false) => (
    <span className={cn("inline-flex items-center gap-1 text-[11px] leading-none whitespace-nowrap", onMedia ? "rounded-full bg-black/45 px-1.5 py-1 text-white" : mine ? "text-white/75" : "text-muted-foreground")}>
      {m.editedAt && <span>edited</span>}
      {time}
      {mine && <Ticks r={p.receipt} onMedia={onMedia} />}
    </span>
  );

  return (
    <div
      id={`msg-${m.id}`}
      className={cn("group/msg flex items-end gap-1.5 px-1", mine ? "justify-end" : "justify-start", last ? "mb-2" : "mb-[3px]", p.highlight && "animate-pulse")}
    >
      {!p.showAvatar && !mine && <div className="w-8 shrink-0" />}
      {p.showAvatar && !mine && m.sender && <UserAvatar src={m.sender.avatarUrl} name={m.sender.displayName} className="size-8 shrink-0 text-[10px]" />}

      <div className={cn("relative flex max-w-[78%] min-w-0 items-center gap-1 sm:max-w-[65%]", mine ? "flex-row-reverse" : "flex-row")}>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
          {/* ── The bubble ── */}
          <DropdownMenuTrigger asChild disabled>
            <div {...menuHandlers} className="relative min-w-0 cursor-default select-text outline-none">
              {gone ? (
                <div className={cn("rounded-2xl px-3 py-1.5 text-sm italic shadow-sm", mine ? "bg-primary/70 text-white/90" : "bg-card text-muted-foreground")}>
                  <Trash2 className="mr-1 inline size-3.5" /> {m.removed ? "Removed by moderators" : "Message deleted"}
                </div>
              ) : bigEmoji ? (
                <div className={cn("flex flex-col", mine ? "items-end" : "items-start", m.pending && "opacity-60")}>
                  <div className="flex gap-1">
                    {bigEmoji.map((e, i) => <AnimatedEmoji key={i} emoji={e} size={bigEmoji.length === 1 ? 112 : 72} />)}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    {reactionChips}
                    <span className="rounded-full bg-black/40 px-2 py-0.5">{meta(true)}</span>
                  </div>
                </div>
              ) : linkOnly ? (
                <div className={cn("flex flex-col", mine ? "items-end" : "items-start", m.pending && "opacity-70")}>
                  {p.showName && m.sender && <div className={cn("mb-0.5 px-1 text-[13px] font-semibold", nameColor(m.sender.id))}>{m.sender.displayName}</div>}
                  <div className="relative">
                    <LinkPreview link={link!} mine={mine} flush />
                    <span className="pointer-events-none absolute top-2 left-2">{meta(true)}</span>
                  </div>
                  {reactionChips}
                </div>
              ) : (
                <div
                  className={cn(
                    "relative rounded-2xl shadow-sm",
                    mine ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground",
                    last && (mine ? "rounded-br-sm" : "rounded-bl-sm"),
                    m.media.length > 0 && !m.content && !isVoice ? "p-0.5" : "px-2.5 pt-1.5 pb-1.5",
                    m.pending && "opacity-80",
                  )}
                >
                  {last && <Tail mine={mine} />}

                  {p.showName && m.sender && <div className={cn("mb-0.5 text-[13px] font-semibold", nameColor(m.sender.id))}>{m.sender.displayName}</div>}

                  {m.forwardedFrom && (
                    <div className={cn("mb-1 text-[13px]", mine ? "text-white/85" : "text-primary")}>
                      <Forward className="mr-1 inline size-3.5" />Forwarded from <b className="font-semibold">{m.forwardedFrom.name}</b>
                    </div>
                  )}

                  {m.replyTo && (
                    <button
                      onClick={() => p.onJumpTo?.(m.replyTo!.id)}
                      className={cn(
                        "mb-1 block w-full rounded-md border-l-[3px] px-2 py-1 text-left text-[13px]",
                        mine ? "border-white/80 bg-white/15" : "border-primary bg-primary/10",
                      )}
                    >
                      <span className={cn("block font-semibold", mine ? "text-white" : "text-primary")}>
                        {m.replyTo.senderId === myId ? "You" : (m.replyTo.senderName ?? "Message")}
                      </span>
                      <span className={cn("line-clamp-1 break-all", mine ? "text-white/85" : "text-muted-foreground")}>
                        {m.replyTo.unsent ? "Deleted message" : m.replyTo.content || (m.replyTo.hasMedia ? "📷 Photo" : m.replyTo.kind === "heart" ? "❤️" : "")}
                      </span>
                    </button>
                  )}

                  {m.storyRef && (
                    <div className="mb-1.5 flex items-center gap-2">
                      <div
                        className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-black/30 bg-cover bg-center"
                        style={m.storyRef.kind === "text" ? { background: m.storyRef.background ?? undefined } : m.storyRef.kind === "image" && m.storyRef.mediaUrl ? { backgroundImage: `url(${m.storyRef.mediaUrl})` } : undefined}
                      >
                        {m.storyRef.kind === "video" && m.storyRef.mediaUrl && <video src={m.storyRef.mediaUrl} muted className="size-full object-cover" />}
                        {m.storyRef.kind === "text" && <span className="absolute inset-0 grid place-items-center p-0.5 text-center text-[6px] leading-tight font-semibold text-white">{m.storyRef.text?.slice(0, 40)}</span>}
                      </div>
                      <span className={cn("text-xs", mine ? "text-white/80" : "text-muted-foreground")}>
                        {mine ? (m.storyRef.action === "reaction" ? "You reacted to their story" : "You replied to their story") : m.storyRef.action === "reaction" ? "Reacted to your story" : "Replied to your story"}
                      </span>
                    </div>
                  )}

                  {isCall && m.call && (
                    <div className="flex min-w-[200px] items-center gap-3 py-0.5">
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", mine ? "bg-white/20" : m.call.status === "ended" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
                        {m.call.status !== "ended" ? <PhoneMissed className="size-5" /> : m.call.kind === "video" ? <Video className="size-5" /> : mine ? <PhoneOutgoing className="size-5" /> : <PhoneIncoming className="size-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold">
                          {m.call.status === "ended"
                            ? `${mine ? "Outgoing" : "Incoming"} ${m.call.kind === "video" ? "video call" : "call"}`
                            : mine
                              ? m.call.status === "declined" ? "Call declined" : m.call.status === "busy" ? "Busy" : "No answer"
                              : `Missed ${m.call.kind === "video" ? "video call" : "call"}`}
                        </div>
                        <div className={cn("text-xs", mine ? "text-white/75" : "text-muted-foreground")}>
                          {time}{m.call.status === "ended" && m.call.duration ? ` · ${formatDuration(m.call.duration)}` : ""}
                        </div>
                      </div>
                      {p.onCallBack && (
                        <button
                          onClick={(e) => { e.stopPropagation(); p.onCallBack!(m.call!.kind); }}
                          className={cn("grid size-9 place-items-center rounded-full", mine ? "hover:bg-white/20" : "text-primary hover:bg-primary/10")}
                          aria-label="Call back"
                          title="Call back"
                        >
                          {m.call.kind === "video" ? <Video className="size-5" /> : <Phone className="size-5" />}
                        </button>
                      )}
                    </div>
                  )}

                  {isVoice && (
                    <div>
                      <VoicePlayer url={m.media[0].url} duration={m.media[0].duration} seed={m.id} mine={mine} />
                      <div className="-mt-3.5 flex justify-end">{meta()}</div>
                    </div>
                  )}

                  {m.media.length > 0 && !isVoice && (
                    <div className={cn("relative grid gap-0.5 overflow-hidden rounded-xl", m.media.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                      {m.media.map((md) =>
                        md.type === "video" ? (
                          <VideoPlayer key={md.url} src={md.url} videoClassName="max-h-96" />
                        ) : (
                          <a key={md.url} href={md.url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={md.url} alt="" loading="lazy" className={cn("w-full object-cover", m.media.length > 1 ? "aspect-square" : "max-h-96")} />
                          </a>
                        ),
                      )}
                      {!m.content && <span className="absolute right-1.5 bottom-1.5">{meta(true)}</span>}
                    </div>
                  )}

                  {m.content && !isCall && (
                    <div className={cn("text-[15px] leading-[1.35] break-words whitespace-pre-wrap", m.media.length > 0 && "px-2 pt-1.5 pb-0.5")}>
                      <Linkified text={m.content} />
                      {/* invisible spacer reserves room so the time never overlaps the last line (Telegram trick) */}
                      <span
                        className={cn("invisible inline-block", m.editedAt ? (mine ? "w-[104px]" : "w-[84px]") : mine ? "w-[62px]" : "w-[42px]")}
                        aria-hidden
                      >.</span>
                      <span className="float-right -mb-1 ml-2 translate-y-1.5">{meta()}</span>
                    </div>
                  )}
                  {link && !linkOnly && <div className="-mx-1 mb-0.5"><LinkPreview link={link} mine={mine} /></div>}

                  {reactionChips}
                </div>
              )}

              {/* Heart / reaction burst */}
              <AnimatePresence>
                {burst > 0 && (
                  <motion.span
                    key={burst}
                    initial={{ scale: 0.3, opacity: 1, y: 0 }}
                    animate={{ scale: 1.5, opacity: 0, y: -24 }}
                    transition={{ duration: 0.8 }}
                    className="pointer-events-none absolute inset-0 grid place-items-center"
                  >
                    <AnimatedEmoji emoji={myReaction ?? "❤️"} size={56} />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </DropdownMenuTrigger>

          {/* Hover affordance (desktop) */}
          {!gone && !m.pending && (
            <button
              onClick={() => setMenuOpen(true)}
              className={cn("rounded-full p-1 text-muted-foreground opacity-0 transition-opacity group-hover/msg:opacity-100 hover:bg-accent", menuOpen && "opacity-100")}
              aria-label="Message options"
            >
              <ChevronDown className="size-4" />
            </button>
          )}

          {/* ── Telegram-style context menu ── */}
          <DropdownMenuContent align={mine ? "end" : "start"} className="w-60 p-1.5">
            <div className="mb-1 flex justify-between rounded-full bg-muted px-1.5 py-1">
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => { react(myReaction === e ? null : e); setMenuOpen(false); }}
                  className={cn("grid size-7 place-items-center rounded-full transition-transform hover:scale-125", myReaction === e && "bg-primary/20")}
                  aria-label={`React ${e}`}
                >
                  <AnimatedEmoji emoji={e} size={22} />
                </button>
              ))}
            </div>
            <DropdownMenuItem onClick={p.onReply}><Reply /> Reply</DropdownMenuItem>
            {p.canEdit && <DropdownMenuItem onClick={p.onEdit}><Pencil /> Edit</DropdownMenuItem>}
            {m.content && m.kind !== "heart" && !isCall && (
              <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(m.content); toast.success("Copied to clipboard"); }}>
                <Copy /> Copy text
              </DropdownMenuItem>
            )}
            {!isCall && <DropdownMenuItem onClick={p.onForward}><Forward /> Forward</DropdownMenuItem>}
            <DropdownMenuItem onClick={p.onPin}>{p.pinned ? <><PinOff /> Unpin</> : <><Pin /> Pin</>}</DropdownMenuItem>
            <DropdownMenuSeparator />
            {!mine && <DropdownMenuItem onClick={p.onReport}><Flag /> Report</DropdownMenuItem>}
            <DropdownMenuItem variant="destructive" onClick={p.onDelete}><Trash2 /> Delete</DropdownMenuItem>
            <div className="px-2 pt-1 text-[11px] text-muted-foreground">
              {format(new Date(m.createdAt), "d MMM yyyy, HH:mm")}{m.editedAt ? ` · edited ${format(new Date(m.editedAt), "HH:mm")}` : ""}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {m.failed && (
        <button onClick={p.onRetry} className="mb-1 text-destructive" aria-label="Retry sending" title="Not sent — tap to retry">
          <AlertCircle className="size-5" />
        </button>
      )}
    </div>
  );
}

/** Turns http(s) links into clickable links (shared posts open in-app). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        let href = part;
        try {
          const u = new URL(part);
          if (typeof window !== "undefined" && u.origin === window.location.origin) href = u.pathname + u.search + u.hash;
        } catch {
          return part;
        }
        const internal = href.startsWith("/");
        return (
          <a
            key={i}
            href={href}
            {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer nofollow" })}
            onClick={(e) => e.stopPropagation()}
            className="break-all underline underline-offset-2 hover:opacity-80"
          >
            {internal ? `${window.location.host}${href.length > 34 ? `${href.slice(0, 33)}…` : href}` : part}
          </a>
        );
      })}
    </>
  );
}
