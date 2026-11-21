export type Visibility = "identity" | "anonymous";
export type FeedMode = "all" | Visibility;
export type Role = "user" | "moderator" | "admin";

export interface Author {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  role: Role;
}

export interface Media {
  id?: string;
  url: string;
  type: "image" | "video" | "audio";
  mime?: string;
  duration?: number; // seconds (voice messages)
}

export interface Post {
  id: string;
  content: string;
  media: Media[];
  visibility: Visibility;
  postType?: "regular" | "avatar_update";
  author: Author | null; // ALWAYS null for anonymous posts
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  likedByMe: boolean;
  isOwner: boolean;
  isRemoved?: boolean;
  sharePolicy?: SharePolicy;
  sharesCount?: number;
  isShare?: boolean;
  /** The original post when this is a share (null = original deleted or unavailable). */
  sharedPost?: Post | null;
  savedByMe?: boolean;
  canShare?: boolean;
}

export type SharePolicy = "everyone" | "friends" | "none";

export interface FeedPage {
  posts: Post[];
  cursor: string | null;
  hasMore: boolean;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  role: Role;
  isVerified: boolean;
  postCount: number;
  profileLocked: boolean;
  createdAt: string;
}

export interface Profile extends PublicUser {
  isMe: boolean;
  blockedByMe: boolean;
  restricted: boolean; // locked and you're not the owner/a friend
  friends: {
    status: FriendStatus;
    canSeeList: boolean; // full friends list visible to you
    count: number | null; // null when the list is private to you
    mutualCount: number;
    mutualPreview: { id: string; displayName: string; avatarUrl: string | null }[];
    visibility?: FriendsVisibility; // only on your own profile
  };
}

export type FriendsVisibility = "public" | "friends" | "only_me";

export interface Photo {
  url: string;
  postId: string;
  createdAt: string;
  isProfilePicture: boolean;
}

export type FriendStatus = "self" | "friends" | "outgoing" | "incoming" | "none";

export interface FriendCard extends PublicUser {
  mutualCount: number;
  mutualPreview: { id: string; displayName: string; avatarUrl: string | null }[];
  requestedAt?: string;
  friendsSince?: string;
  viewerStatus?: FriendStatus;
}

export interface SelfUser extends PublicUser {
  email: string;
  mfaEnabled: boolean;
  showActivity: boolean;
  friendsVisibility: FriendsVisibility;
  birthDate: string | null;
  gender: string | null;
  anonAvailableAt: string;
  canPostAnonymously: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  isRemoved: boolean;
  author: Author | null;
  /** Written by the anonymous post's own author, shown as "Anonymous · Author" (author is null). */
  isPostAuthor?: boolean;
  /** You wrote it (also true for your anonymous author replies). */
  isMine?: boolean;
  likesCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "like" | "comment" | "reply" | "security" | "system" | "moderation" | "friend_request" | "friend_accept" | "share";
  message: string | null;
  postId: string | null;
  commentId: string | null;
  postExcerpt: string | null;
  actor: { id: string; username: string; displayName: string; avatarUrl: string | null } | null;
  /** The person who acted was anonymous (e.g. the anonymous author replied). */
  actorAnon?: boolean;
  /** About activity on one of YOUR anonymous posts (only you can see this). */
  onAnonymousPost?: boolean;
  read: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
}

export interface PublicSettings {
  site: {
    name: string;
    tagline: string;
    description: string;
    logoUrl: string | null;
    footerText: string;
    announcement: { enabled: boolean; text: string; variant: "info" | "success" | "warning" | "danger"; link: string | null };
  };
  features: {
    registrationEnabled: boolean;
    anonymousPostingEnabled: boolean;
    commentsEnabled: boolean;
    mediaUploadsEnabled: boolean;
    messagingEnabled: boolean;
    videoUploadsEnabled: boolean;
    requireEmailVerification: boolean;
    maintenanceMode: boolean;
    maintenanceMessage: string;
  };
  limits: {
    maxPostLength: number;
    maxCommentLength: number;
    maxFriends?: number;
    maxMediaPerPost: number;
    maxImageMb: number;
    maxVideoMb: number;
    anonAccountAgeHours: number;
  };
}

// ── Direct messages ──
export interface ChatUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  role: "admin" | "member";
  online: boolean | null; // null = hidden (activity status off)
  lastActiveAt: string | null;
  lastReadAt: string | null;
  deactivated: boolean;
}

export interface Conversation {
  id: string;
  isGroup: boolean;
  title: string | null;
  status: "accepted" | "pending";
  myRole: "admin" | "member";
  muted: boolean;
  unreadCount: number;
  lastMessageAt: string;
  lastMessage: { id: string; senderId: string | null; kind: string; preview: string; createdAt: string } | null;
  memberCount: number;
  participants: ChatUser[];
  blockedByMe: boolean;
  blockedMe: boolean;
  pinned: boolean; // pinned to the top of MY chat list
  pinnedMessage: { id: string; senderName: string | null; preview: string } | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  kind: "text" | "media" | "heart" | "system" | "call";
  content: string;
  media: Media[];
  unsent: boolean;
  removed: boolean;
  sender: { id: string; username: string; displayName: string; avatarUrl: string | null; isVerified: boolean } | null;
  replyTo: { id: string; senderId: string | null; senderName: string | null; kind: string; content: string; hasMedia: boolean; unsent: boolean } | null;
  reactions: { emoji: string; userId: string }[];
  editedAt: string | null;
  forwardedFrom: { name: string; userId: string | null } | null;
  call?: { kind: "audio" | "video"; status: "ended" | "missed" | "declined" | "busy"; duration: number } | null;
  storyRef?: { storyId: string; kind: "image" | "video" | "text"; mediaUrl: string | null; text: string | null; background: string | null; action: "reply" | "reaction" } | null;
  createdAt: string;
  // client-only
  clientId?: string;
  pending?: boolean;
  failed?: boolean;
}

export interface MessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
  cursor: string | null;
}

// ── Stories ──
export interface Story {
  id: string;
  kind: "image" | "video" | "text";
  mediaUrl: string | null;
  text: string | null;
  background: string | null;
  audience: "friends" | "public";
  createdAt: string;
  expiresAt: string;
  seen: boolean;
  viewCount?: number; // author only
  myReaction?: string | null;
}

export interface StoryGroup {
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; isVerified: boolean };
  isMe: boolean;
  stories: Story[];
  hasUnseen: boolean;
  latestAt: string;
}
