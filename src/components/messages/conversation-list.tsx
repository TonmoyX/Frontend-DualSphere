"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, Check, CheckCheck, Pencil, Pin, PinOff, Search, Trash2, BellRing } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { del, errorMessage, get, patch, put } from "@/lib/api";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { ConversationAvatar } from "./chat-avatar";
import { conversationName, dmKeys, listTime, useTyping } from "./dm";
import { NewMessageDialog } from "./new-message-dialog";

/** Telegram-style chat row: name + time · preview + unread pill / ticks. Right-click for actions. */
function Row({ c, active, myId }: { c: Conversation; active: boolean; myId?: string }) {
  const qc = useQueryClient();
  const [menu, setMenu] = useState(false);
  const typers = useTyping(c.id);
  const lm = c.lastMessage;
  const mine = lm?.senderId === myId && lm?.kind !== "system";
  const read = mine && c.participants.some((p) => p.lastReadAt && lm && new Date(p.lastReadAt) >= new Date(lm.createdAt));
  const typing = c.participants.filter((p) => typers.includes(p.id));

  const refresh = () => qc.invalidateQueries({ queryKey: ["dm"] });
  const act = (fn: () => Promise<unknown>) => fn().then(refresh).catch((e) => toast.error(errorMessage(e)));

  return (
    <DropdownMenu open={menu} onOpenChange={setMenu} modal={false}>
      <DropdownMenuTrigger asChild disabled>
        <Link
          href={`/messages/${c.id}`}
          onContextMenu={(e) => { e.preventDefault(); setMenu(true); }}
          className={cn("mx-2 flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors", active ? "bg-primary text-primary-foreground" : "hover:bg-accent/70")}
        >
          <div className={cn("shrink-0 rounded-full", active && "bg-card")}><ConversationAvatar c={c} size={54} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-semibold">{conversationName(c)}</span>
              {c.muted && <BellOff className={cn("size-3.5 shrink-0", active ? "text-primary-foreground/70" : "text-muted-foreground")} />}
              <span className="ml-auto flex shrink-0 items-center gap-0.5 text-xs">
                {mine && (read ? <CheckCheck className={cn("size-4", active ? "text-primary-foreground" : "text-primary")} /> : <Check className={cn("size-4", active ? "text-primary-foreground" : "text-primary")} />)}
                <span className={active ? "text-primary-foreground/80" : "text-muted-foreground"}>{lm ? listTime(lm.createdAt) : ""}</span>
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className={cn("min-w-0 flex-1 truncate text-sm", active ? "text-primary-foreground/85" : "text-muted-foreground")}>
                {typing.length ? (
                  <span className={active ? "text-primary-foreground" : "text-primary"}>
                    {c.isGroup ? `${typing[0].displayName.split(" ")[0]} is typing…` : "typing…"}
                  </span>
                ) : lm ? (
                  <>
                    {mine && <span className={active ? "" : "text-foreground/80"}>You: </span>}
                    {lm.preview}
                  </>
                ) : (
                  "No messages yet"
                )}
              </span>
              {c.unreadCount > 0 ? (
                <span className={cn(
                  "grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-xs font-semibold",
                  active ? "bg-primary-foreground text-primary" : c.muted ? "bg-muted-foreground/40 text-white" : "bg-primary text-primary-foreground",
                )}>
                  {c.unreadCount > 99 ? "99+" : c.unreadCount}
                </span>
              ) : c.pinned ? (
                <Pin className={cn("size-3.5 shrink-0 rotate-45", active ? "text-primary-foreground/70" : "text-muted-foreground")} />
              ) : null}
            </div>
          </div>
        </Link>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={() => act(() => put(`/conversations/${c.id}/pin`, { pinned: !c.pinned }))}>
          {c.pinned ? <><PinOff /> Unpin</> : <><Pin /> Pin to top</>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => act(() => patch(`/conversations/${c.id}`, { muted: !c.muted }))}>
          {c.muted ? <><BellRing /> Unmute</> : <><BellOff /> Mute</>}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => act(() => del(`/conversations/${c.id}`))}>
          <Trash2 /> Delete chat (for me)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ConversationList() {
  const { user } = useAuth();
  const params = useParams<{ id?: string }>();
  const [folder, setFolder] = useState<"primary" | "requests">("primary");
  const [q, setQ] = useState("");
  const [composing, setComposing] = useState(false);
  const [, tick] = useState(0);

  // keep "typing…" and relative times fresh
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: [...dmKeys.list(folder), q],
    queryFn: async () => (await get<{ conversations: Conversation[] }>(`/conversations?folder=${folder}${q ? `&q=${encodeURIComponent(q)}` : ""}`)).conversations,
    enabled: !!user,
  });
  const { data: unread } = useQuery({
    queryKey: dmKeys.unread,
    queryFn: () => get<{ primary: number; requests: number }>("/conversations/unread-count"),
    enabled: !!user,
  });

  return (
    <div className="relative flex h-full flex-col bg-card">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="h-10 w-full rounded-full bg-muted pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 border-b px-3">
        {(["primary", "requests"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFolder(f)}
            className={cn("relative px-3 py-2.5 text-sm font-semibold transition-colors", folder === f ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {f === "primary" ? "All chats" : "Requests"}
            {f === "primary" && !!unread?.primary && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{unread.primary}</span>}
            {f === "requests" && !!unread?.requests && <span className="ml-1.5 rounded-full bg-muted-foreground/30 px-1.5 text-[11px]">{unread.requests}</span>}
            {folder === f && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-t-full bg-primary" />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto py-1.5">
        {isLoading &&
          Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2">
              <Skeleton className="size-[54px] rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-48" /></div>
            </div>
          ))}
        {data?.length === 0 && (
          <div className="px-8 py-12 text-center text-sm text-muted-foreground">
            {folder === "requests" ? "No message requests. Messages from people who aren't your friends show up here." : q ? "No chats match." : "No chats yet. Tap the pencil to start one."}
          </div>
        )}
        {data?.map((c) => <Row key={c.id} c={c} active={params?.id === c.id} myId={user?.id} />)}
      </div>

      {/* Floating "new message" (Telegram) */}
      <button
        onClick={() => setComposing(true)}
        className="absolute right-4 bottom-4 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="New message"
        title="New message"
      >
        <Pencil className="size-6" />
      </button>

      <NewMessageDialog open={composing} onOpenChange={setComposing} />
    </div>
  );
}
