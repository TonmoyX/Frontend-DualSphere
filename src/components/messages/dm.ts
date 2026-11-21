"use client";

import { useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { post } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { ChatMessage, Conversation, MessagePage } from "@/lib/types";

export const dmKeys = {
  list: (folder: "primary" | "requests") => ["dm", "list", folder] as const,
  conv: (id: string) => ["dm", "conv", id] as const,
  msgs: (id: string) => ["dm", "msgs", id] as const,
  unread: ["dm", "unread"] as const,
  typing: ["dm", "typing"] as const,
};

/** conversationId → { userId → timestamp } — shared so the list and header both show "typing…". */
export type TypingMap = Record<string, Record<string, number>>;

export function useTyping(conversationId?: string) {
  const { data } = useQuery<TypingMap>({ queryKey: dmKeys.typing, queryFn: () => ({}), staleTime: Infinity, gcTime: Infinity, initialData: {} });
  if (!conversationId) return [] as string[];
  return Object.keys(data?.[conversationId] ?? {}); // entries expire on their own (see onTyping)
}

export function conversationName(c: Pick<Conversation, "isGroup" | "title" | "participants">) {
  if (c.title) return c.title;
  if (!c.participants.length) return "Just you";
  if (!c.isGroup) return c.participants[0].displayName;
  const names = c.participants.map((p) => p.displayName.split(" ")[0]);
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ");
}

/** Telegram-style status: "online" · "last seen 5 minutes ago" · "last seen yesterday at 14:02" · "last seen recently". */
export function presenceText(c: Conversation): string | null {
  const ps = c.participants;
  if (c.isGroup) {
    const on = ps.filter((p) => p.online).length;
    return `${c.memberCount} members${on ? `, ${on} online` : ""}`;
  }
  const p = ps[0];
  if (!p) return null;
  if (p.online) return "online";
  if (p.online === null) return "last seen recently"; // activity status hidden
  if (!p.lastActiveAt) return "last seen a long time ago";
  const d = new Date(p.lastActiveAt);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "last seen just now";
  if (mins < 60) return `last seen ${mins} minute${mins > 1 ? "s" : ""} ago`;
  if (isToday(d)) return `last seen at ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `last seen yesterday at ${format(d, "HH:mm")}`;
  if (Date.now() - d.getTime() < 7 * 86_400_000) return `last seen ${format(d, "EEE 'at' HH:mm")}`;
  return `last seen ${format(d, "d MMM yyyy")}`;
}

/** Chat-list timestamp: 14:02 · Mon · 12 Nov · 12.11.25 */
export function listTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (Date.now() - d.getTime() < 6 * 86_400_000) return format(d, "EEE");
  if (d.getFullYear() === new Date().getFullYear()) return format(d, "d MMM");
  return format(d, "dd.MM.yy");
}

export function shortAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

// ── cache helpers ────────────────────────────────────────────────
export function appendMessage(qc: QueryClient, conversationId: string, msg: ChatMessage, clientId?: string | null) {
  qc.setQueryData<InfiniteData<MessagePage>>(dmKeys.msgs(conversationId), (d) => {
    if (!d) return d;
    const first = d.pages[0];
    const exists = first.messages.some((m) => m.id === msg.id);
    let messages = first.messages;
    if (clientId && messages.some((m) => m.clientId === clientId)) {
      messages = messages.map((m) => (m.clientId === clientId ? msg : m));
    } else if (!exists) {
      messages = [...messages, msg];
    }
    // drop duplicates (optimistic + echo)
    const seen = new Set<string>();
    messages = messages.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
    return { ...d, pages: [{ ...first, messages }, ...d.pages.slice(1)] };
  });
}

export function patchMessage(qc: QueryClient, conversationId: string, messageId: string, fn: (m: ChatMessage) => ChatMessage) {
  qc.setQueryData<InfiniteData<MessagePage>>(dmKeys.msgs(conversationId), (d) =>
    d ? { ...d, pages: d.pages.map((p) => ({ ...p, messages: p.messages.map((m) => (m.id === messageId ? fn(m) : m)) })) } : d,
  );
}

export function removeMessage(qc: QueryClient, conversationId: string, messageId: string) {
  qc.setQueryData<InfiniteData<MessagePage>>(dmKeys.msgs(conversationId), (d) =>
    d ? { ...d, pages: d.pages.map((p) => ({ ...p, messages: p.messages.filter((m) => m.id !== messageId) })) } : d,
  );
}

export function patchConversation(qc: QueryClient, id: string, fn: (c: Conversation) => Conversation) {
  qc.setQueryData<Conversation>(dmKeys.conv(id), (c) => (c ? fn(c) : c));
  qc.setQueriesData<Conversation[]>({ queryKey: ["dm", "list"] }, (l) => l?.map((c) => (c.id === id ? fn(c) : c)));
}

function patchPresence(qc: QueryClient, userId: string, online: boolean, lastActiveAt: string | null) {
  const fix = (c: Conversation): Conversation => ({
    ...c,
    participants: c.participants.map((p) => (p.id === userId ? { ...p, online, lastActiveAt: lastActiveAt ?? p.lastActiveAt } : p)),
  });
  qc.setQueriesData<Conversation>({ queryKey: ["dm", "conv"] }, (c) => (c ? fix(c) : c));
  qc.setQueriesData<Conversation[]>({ queryKey: ["dm", "list"] }, (l) => l?.map(fix));
}

/**
 * Global DM socket wiring (mounted once). Keeps lists, threads, unread badges,
 * receipts, reactions and presence in sync, and toasts new messages elsewhere.
 */
export function useDmRealtime(myId: string | undefined) {
  const qc = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!myId) return;
    const s = getSocket();
    const refreshLists = () => {
      qc.invalidateQueries({ queryKey: ["dm", "list"] });
      qc.invalidateQueries({ queryKey: dmKeys.unread });
    };

    const onMessage = ({ conversationId, message, clientId }: { conversationId: string; message: ChatMessage; clientId: string | null }) => {
      appendMessage(qc, conversationId, message, message.sender?.id === myId ? clientId : null);
      refreshLists();
      const viewing = pathRef.current === `/messages/${conversationId}`;
      if (viewing && message.sender?.id !== myId && document.visibilityState === "visible") {
        void post(`/conversations/${conversationId}/read`).catch(() => {});
      }
      if (!viewing && message.sender && message.sender.id !== myId && message.kind !== "system") {
        const conv = qc.getQueryData<Conversation>(dmKeys.conv(conversationId));
        if (conv?.muted) return;
        const body = message.kind === "heart" ? "❤️" : message.content || (message.media.length ? "Sent an attachment" : "");
        toast(message.sender.displayName, {
          description: body.length > 80 ? `${body.slice(0, 80)}…` : body,
          action: { label: "Reply", onClick: () => router.push(`/messages/${conversationId}`) },
        });
      }
    };
    const onRead = ({ conversationId, userId, lastReadAt }: { conversationId: string; userId: string; lastReadAt: string }) =>
      patchConversation(qc, conversationId, (c) => ({
        ...c,
        participants: c.participants.map((p) => (p.id === userId ? { ...p, lastReadAt } : p)),
      }));
    const onReaction = ({ conversationId, messageId, reactions }: { conversationId: string; messageId: string; reactions: ChatMessage["reactions"] }) =>
      patchMessage(qc, conversationId, messageId, (m) => ({ ...m, reactions }));
    const onUnsend = ({ conversationId, messageId, removed }: { conversationId: string; messageId: string; removed?: boolean }) => {
      patchMessage(qc, conversationId, messageId, (m) => ({ ...m, unsent: !removed, removed: !!removed, content: "", media: [], reactions: [] }));
      refreshLists();
    };
    const onConversation = ({ conversationId }: { conversationId: string }) => {
      qc.invalidateQueries({ queryKey: dmKeys.conv(conversationId) });
      qc.invalidateQueries({ queryKey: dmKeys.msgs(conversationId) });
      refreshLists();
    };
    const onPresence = ({ userId, online, lastActiveAt }: { userId: string; online: boolean; lastActiveAt: string | null }) =>
      patchPresence(qc, userId, online, lastActiveAt);
    const onEdit = ({ conversationId, message }: { conversationId: string; message: ChatMessage }) => {
      patchMessage(qc, conversationId, message.id, () => message);
      refreshLists();
    };
    const onDeleted = ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      removeMessage(qc, conversationId, messageId);
      // replies that quoted it lose the quote (the original no longer exists)
      qc.setQueryData<InfiniteData<MessagePage>>(dmKeys.msgs(conversationId), (d) =>
        d ? { ...d, pages: d.pages.map((p) => ({ ...p, messages: p.messages.map((m) => (m.replyTo?.id === messageId ? { ...m, replyTo: null } : m)) })) } : d,
      );
      qc.invalidateQueries({ queryKey: dmKeys.conv(conversationId) }); // pinned message may be gone
      refreshLists();
    };
    const onHidden = ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      removeMessage(qc, conversationId, messageId);
      refreshLists();
    };
    const setTypingEntry = (conversationId: string, userId: string, at: number | null) =>
      qc.setQueryData<TypingMap>(dmKeys.typing, (m = {}) => {
        const conv = { ...(m[conversationId] ?? {}) };
        if (at) conv[userId] = at;
        else delete conv[userId];
        return { ...m, [conversationId]: conv };
      });
    const onTyping = ({ conversationId, userId, typing }: { conversationId: string; userId: string; typing: boolean }) => {
      if (!typing) return setTypingEntry(conversationId, userId, null);
      const at = Date.now();
      setTypingEntry(conversationId, userId, at);
      // Auto-expire after 6s unless refreshed by another typing event
      setTimeout(() => {
        const cur = qc.getQueryData<TypingMap>(dmKeys.typing)?.[conversationId]?.[userId];
        if (cur === at) setTypingEntry(conversationId, userId, null);
      }, 6000);
    };
    const clearTyping = ({ conversationId, message }: { conversationId: string; message: ChatMessage }) =>
      message.sender && onTyping({ conversationId, userId: message.sender.id, typing: false });
    const onBlock = () => {
      qc.invalidateQueries({ queryKey: ["dm"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    };

    s.on("dm:message", onMessage);
    s.on("dm:read", onRead);
    s.on("dm:reaction", onReaction);
    s.on("dm:unsend", onUnsend);
    s.on("dm:conversation", onConversation);
    s.on("dm:unread", refreshLists);
    s.on("dm:block", onBlock);
    s.on("dm:edit", onEdit);
    s.on("dm:hidden", onHidden);
    s.on("dm:deleted", onDeleted);
    s.on("dm:typing", onTyping);
    s.on("dm:message", clearTyping);
    s.on("user:presence", onPresence);
    return () => {
      s.off("dm:message", onMessage);
      s.off("dm:read", onRead);
      s.off("dm:reaction", onReaction);
      s.off("dm:unsend", onUnsend);
      s.off("dm:conversation", onConversation);
      s.off("dm:unread", refreshLists);
      s.off("dm:block", onBlock);
      s.off("dm:edit", onEdit);
      s.off("dm:hidden", onHidden);
      s.off("dm:deleted", onDeleted);
      s.off("dm:typing", onTyping);
      s.off("dm:message", clearTyping);
      s.off("user:presence", onPresence);
    };
  }, [myId, qc, router]);
}
