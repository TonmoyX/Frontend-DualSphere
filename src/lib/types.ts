export type Visibility = "identity" | "anonymous";
export type FeedMode = "all" | Visibility | "communities";
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
  postType?: "regular" | "avatar_update" | "cover_update";
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
  /** Set when the author edited the text after posting. */
  editedAt?: string | null;
  /** Real views: distinct signed-in people (not the author) who saw it. */
  viewsCount?: number;
  /** Friends tagged in the post (identity posts only). */
  tags?: PostTag[];
  /** The original post when this is a share (null = original deleted or unavailable). */
  sharedPost?: Post | null;
  savedByMe?: boolean;
  canShare?: boolean;
  /** Set when the post belongs to a community. */
  community?: { id: string; slug: string; name: string; iconUrl: string | null } | null;
  isPinned?: boolean;
  isPending?: boolean; // waiting for community-mod approval
  /** Paid / subscriber-only. `locked` = you haven't paid: content is a preview and media is withheld. */
  access?: "public" | "subscribers" | "paid";
  priceMinor?: number | null;
  currency?: "USD" | null;
  locked?: boolean;
  lockedMediaCount?: number;
}

export type SharePolicy = "everyone" | "friends" | "none";

export interface PostTag { id: string; username: string; displayName: string }

export interface FeedPage {
  posts: Post[];
  cursor: string | null;
  hasMore: boolean;
  pinned?: Post[]; // community feeds: pinned posts, first page only
  locked?: boolean; // community feeds: you can't see this community's posts
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

/** Optional "About" details shown in the profile Intro. */
export interface ProfileDetails {
  work: string;
  education: string;
  location: string;
  hobbies: string[];
  birthday?: Birthday | null; // only what the owner chose to show
}

export interface Birthday {
  day: number;
  month: number;
  year?: number; // only when shown as the full date
}

export type BirthdayDisplay = "hidden" | "day_month" | "full";

export interface Profile extends PublicUser, ProfileDetails {
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
  follow?: FollowInfo;
}

export interface FollowInfo {
  followers: number | null; // null when the profile is locked to you
  following: number | null;
  isFollowing: boolean; // you follow them
  followsMe: boolean; // they follow you
}

export interface FollowUser extends PublicUser {
  viewerFollows: boolean;
  isMe: boolean;
}

export type FriendsVisibility = "public" | "friends" | "only_me";

export interface Photo {
  url: string;
  postId: string;
  createdAt: string;
  isProfilePicture: boolean;
  isCoverPhoto?: boolean;
}

export type FriendStatus = "self" | "friends" | "outgoing" | "incoming" | "none";

export interface FriendCard extends PublicUser {
  mutualCount: number;
  mutualPreview: { id: string; displayName: string; avatarUrl: string | null }[];
  requestedAt?: string;
  friendsSince?: string;
  viewerStatus?: FriendStatus;
}

export interface SelfUser extends PublicUser, ProfileDetails {
  email: string;
  mfaEnabled: boolean;
  showActivity: boolean;
  followingVisibility?: FriendsVisibility;
  friendsVisibility: FriendsVisibility;
  birthDate: string | null;
  birthdayDisplay?: BirthdayDisplay;
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
  type: "like" | "comment" | "reply" | "security" | "system" | "moderation" | "friend_request" | "friend_accept" | "share" | "tag";
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
  /** Group photo (groups only) */
  avatarUrl?: string | null;
  status: "accepted" | "pending";
  myRole: "admin" | "member";
  muted: boolean;
  unreadCount: number;
  lastMessageAt: string;
  lastMessage: { id: string; senderId: string | null; kind: string; preview: string; createdAt: string; anonymous?: boolean } | null;
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
  /** Sent anonymously in a group: `sender` is null for everyone except the person who sent it. */
  anonymous?: boolean;
  sender: { id: string; username: string; displayName: string; avatarUrl: string | null; isVerified: boolean } | null;
  replyTo: { id: string; senderId: string | null; senderName: string | null; kind: string; content: string; hasMedia: boolean; unsent: boolean } | null;
  reactions: { emoji: string; userId: string }[];
  editedAt: string | null;
  forwardedFrom: { name: string; userId: string | null } | null;
  call?: { kind: "audio" | "video"; status: "ended" | "missed" | "declined" | "busy"; duration: number; group?: boolean; participants?: number } | null;
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

// ── Communities ──
export type CommunityRole = "owner" | "mod" | "member";
export type CommunityVisibility = "public" | "private" | "invite_only";
export type AnonPolicy = "off" | "allowed" | "anon_only";

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  visibility: CommunityVisibility;
  anonPolicy: AnonPolicy;
  postApproval: boolean;
  tags: string[];
  memberCount: number;
  postCount: number;
  isFeatured: boolean;
  isSuspended: boolean;
  suspendedReason: string | null;
  createdAt: string;
  owner: { id: string; username: string; displayName: string; avatarUrl: string | null } | null;
  viaInvite?: boolean;
  viewer: {
    role: CommunityRole | null;
    isMember: boolean;
    isBanned: boolean;
    hasRequested: boolean;
    mutedUntil: string | null;
    canSeeContent: boolean;
    canPost: boolean;
    canModerate: boolean;
    isOwner: boolean;
  };
}

export interface CommunityRule { id: string; title: string; body: string }

export interface CommunityListItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  visibility: CommunityVisibility;
  anonPolicy: AnonPolicy;
  memberCount: number;
  postCount: number;
  isFeatured: boolean;
  tags: string[];
  role: CommunityRole | null;
}

export interface CommunityMember extends PublicUser {
  communityRole: CommunityRole;
  joinedAt: string;
  mutedUntil: string | null;
}

// ── Money (creator economy + ads) ──
export type Currency = "USD";
export type PostAccess = "public" | "subscribers" | "paid";
export interface Tier { id: string; name: string; description: string; benefits: string[]; priceMinor: number; currency: Currency; isActive: boolean; memberCount?: number }
export interface CreatorPublic {
  isCreator: boolean;
  tagline?: string;
  tipsEnabled: boolean;
  currency?: Currency;
  tiers: Tier[];
  membership: { id: string; tierId: string; status: "active" | "canceled"; currentPeriodEnd: string } | null;
}
