# DualSphere — Web App

The user-facing web app for **DualSphere**, a social network where you can post either **with your identity** or **anonymously**, and switch between the two at any time.

This repo is one of three:

| Repo | What it is | Default port |
| --- | --- | --- |
| **Frontend** (this repo) | The user-facing Next.js web app | `3000` |
| Admin | The staff / moderation panel (Next.js) | `3001` |
| Backend | Express API, PostgreSQL, Socket.io | `4000` |

The web app talks to the backend API, so the backend must be running for anything to work.

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (Radix primitives) + `tw-animate-css`
- **TanStack Query** for server state, caching and optimistic updates
- **Socket.io client** for realtime features
- **Framer Motion** for animations
- **Zod** for form validation
- **date-fns**, **lucide-react** icons, **sonner** toasts

---

## Features

### Authentication
- Landing page with sign up and login
- Email verification, forgot / reset password
- Two-factor login (TOTP)
- Auth uses **HttpOnly cookies**, so JavaScript never sees the tokens. Expired access tokens are refreshed automatically: one refresh at a time, then the request is retried.

### Feed and posts
- Home feed with a switch between **Everything / Identity / Anonymous**
- Post composer: choose identity or anonymous, add text, photos and video
- Media grid, built-in video player, reels
- Likes, nested comment threads, share (with share rules), save for later, report
- Single post page and post modal
- Live comment updates over Socket.io

### Profiles and friends
- Profile pages with posts, photos, reels and friends tabs
- Avatar upload, profile editing, profile lock
- Friend requests, friend list, suggestions

### Stories
- Story bar, story creation (media or text on a background), full-screen viewer
- Views, reactions and replies

### Messaging and calls
- Conversation list and chat threads, one-to-one and group
- Message requests, reactions, edit / delete / forward, pinned messages, in-chat search
- Voice messages, link previews, animated emoji, typing indicators, read state
- Voice and video calls (WebRTC)

### More
- Notifications with unread counts in realtime
- Search for users and content
- Saved posts
- Settings: profile, security (password, 2FA), privacy, active sessions, appearance / theme
- "Report a problem" dialog
- Help, community guidelines, terms, privacy and cookies pages
- SEO: metadata, dynamic Open Graph images for posts and profiles, `sitemap.xml`, `robots.txt`, web app manifest

---

## Project structure

```
src/
├── app/                  # App Router routes
│   ├── page.tsx          # Landing / auth entry
│   ├── feed/             # Home feed
│   ├── post/[id]/        # Single post (+ OG image)
│   ├── profile/[username]/
│   ├── messages/ [id]/   # Chat
│   ├── friends/  notifications/  saved/  search/  settings/
│   ├── login/  signup/  verify-email/  forgot-password/  reset-password/
│   ├── help/  guidelines/  terms/  privacy/  cookies/
│   ├── sitemap.ts  robots.ts  manifest.ts  opengraph-image.tsx
│   └── layout.tsx
├── components/
│   ├── auth/  post/  profile/  friends/  stories/  messages/  calls/
│   ├── layout/           # navbar, account menu, site chrome
│   ├── common/           # shared pieces (theme picker, video player, …)
│   └── ui/               # shadcn/ui components
├── lib/                  # api client, socket, upload, theme, SEO helpers, types
└── providers/            # auth, settings, React Query, realtime bridge
```

---

## Getting started

### Requirements
- Node.js 20+
- The **DualSphere backend** running (by default at `http://localhost:4000`)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your local environment file
cp .env.example .env.local

# 3. Start the dev server
npm run dev
```

Open http://localhost:3000.

### Environment variables

Set these in `.env.local`. All of them are public, browser-side values (`NEXT_PUBLIC_*`). **Never put secrets here.**

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_SITE_URL` | Public URL of this web app (used for SEO and OG links) |
| `NEXT_PUBLIC_ADMIN_URL` | Admin panel URL (shown to staff accounts) |
| `NEXT_PUBLIC_MEDIA_URL` | Public media URL (must match the backend's media / R2 public URL) |

> `.env.local` is gitignored. Only `.env.example` is committed.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

---

## Notes

- This project uses a recent Next.js version with breaking changes compared to older releases. See `AGENTS.md` and the docs in `node_modules/next/dist/docs/` before changing framework-level code.
- The backend's CORS whitelist (`CORS_ORIGINS`) must include this app's URL, or requests that use cookies will fail.
