"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated emoji (Telegram-style) using Google's open-source Noto Animated Emoji.
 * Tries the full codepoint sequence, then without the VS16 selector, then falls back
 * to the plain text emoji — so nothing ever renders broken.
 */
const BASE = "https://fonts.gstatic.com/s/e/notoemoji/latest";

function codepoints(emoji: string, keepVs16: boolean) {
  return Array.from(emoji)
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((cp) => keepVs16 || cp !== "fe0f")
    .join("_");
}

export function AnimatedEmoji({ emoji, size = 32, className, title }: { emoji: string; size?: number; className?: string; title?: string }) {
  const [attempt, setAttempt] = useState(0); // 0: with fe0f · 1: without · 2: text fallback
  const hasVs16 = emoji.includes("️");
  if (attempt >= 2 || (attempt === 1 && !hasVs16)) {
    return (
      <span className={cn("inline-block leading-none", className)} style={{ fontSize: size * 0.85, width: size, height: size }} role="img" aria-label={title ?? emoji}>
        {emoji}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${BASE}/${codepoints(emoji, attempt === 0)}/512.webp`}
      alt={emoji}
      title={title}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      onError={() => setAttempt((a) => (a === 0 && hasVs16 ? 1 : 2))}
      className={cn("inline-block select-none", className)}
      style={{ width: size, height: size }}
    />
  );
}

const EMOJI_RE = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*/gu;

/** If the text is only 1–3 emoji (Telegram shows these big & animated), return them. */
export function emojiOnly(text: string): string[] | null {
  const t = text.trim();
  if (!t || t.length > 32) return null;
  const found = t.match(EMOJI_RE);
  if (!found || found.length > 3) return null;
  return found.join("") === t.replace(/\s+/g, "") ? found : null;
}

export const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥", "🎉", "🙏"];

export const EMOJI_PICKER = [
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😉", "😊", "😇",
  "🥰", "😍", "🤩", "😘", "😋", "😜", "🤪", "😎", "🤓", "🥳", "😏", "😒",
  "😔", "😢", "😭", "😤", "😡", "🤯", "😳", "🥺", "😱", "🤗", "🤔", "🤫",
  "😴", "🤤", "😷", "🤒", "👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "👀",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔", "💯", "🔥", "✨", "🎉",
  "🎂", "🎁", "🌹", "☕", "🍕", "⚽", "🚀", "⭐", "🌙", "☀️", "🌈", "💤",
];
