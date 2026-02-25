import { apiRequest } from "./api";

export type SocialProfile = {
  id: string;
  walletAddress: string;
  handle: string;
  bio: string;
  avatarUrl?: string;
  followers: number;
  following: number;
  source?: "tapestry" | "mock";
};

export type SocialComment = {
  id: string;
  postId: string;
  profileId?: string;
  comment: string;
  createdAt: string;
};

export type SocialPost = {
  id: string;
  profileId: string;
  authorHandle: string;
  authorAvatarUrl?: string;
  content: string;
  migrationSlug?: string;
  tags: string[];
  likes: number;
  comments: SocialComment[];
  createdAt: string;
  score?: number;
  namespace?: string;
  source?: "tapestry" | "mock";
};

type FeedOptions = {
  profileId?: string;
  tag?: string;
  query?: string;
};

type CreatePostInput = {
  profileId: string;
  content: string;
  migrationSlug?: string;
  tags?: string[];
};

export const socialApi = {
  createOrGetProfile: (walletAddress: string, handle?: string, bio?: string, avatarUrl?: string) =>
    apiRequest<{ profile: SocialProfile }>("/api/social/profile", {
      method: "POST",
      body: { walletAddress, handle, bio, avatarUrl },
    }),
  follow: (currentUserId: string, targetUserId: string) =>
    apiRequest<{ ok: boolean }>("/api/social/follow", {
      method: "POST",
      body: { currentUserId, targetUserId },
    }),
  unfollow: (currentUserId: string, targetUserId: string) =>
    apiRequest<{ ok: boolean }>("/api/social/unfollow", {
      method: "POST",
      body: { currentUserId, targetUserId },
    }),
  createPost: (input: CreatePostInput) =>
    apiRequest<{ post: SocialPost }>("/api/social/post", {
      method: "POST",
      body: input,
    }),
  postMigration: (profileId: string, migrationSlug: string) =>
    apiRequest<{ post: SocialPost }>("/api/social/post", {
      method: "POST",
      body: { profileId, migrationSlug },
    }),
  like: (postId: string) =>
    apiRequest<{ ok: boolean; likes?: number }>("/api/social/like", {
      method: "POST",
      body: { postId },
    }),
  comment: (postId: string, comment: string, profileId?: string) =>
    apiRequest<{ comment: SocialComment }>("/api/social/comment", {
      method: "POST",
      body: { postId, comment, profileId },
    }),
  getFeed: (options?: FeedOptions) => {
    const query = new URLSearchParams();
    if (options?.profileId) query.set("profileId", options.profileId);
    if (options?.tag) query.set("tag", options.tag);
    if (options?.query) query.set("query", options.query);
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return apiRequest<{ feed: SocialPost[] }>(`/api/social/feed${suffix}`);
  },
  getTrending: (limit = 8, namespace = "revivepass") =>
    apiRequest<{ feed: SocialPost[] }>(
      `/api/social/trending?limit=${encodeURIComponent(limit)}&namespace=${encodeURIComponent(namespace)}`
    ),
  search: (query: string, namespace = "revivepass") =>
    apiRequest<{ feed: SocialPost[] }>(
      `/api/social/search?query=${encodeURIComponent(query)}&namespace=${encodeURIComponent(namespace)}`
    ),
  getPost: (postId: string) =>
    apiRequest<{ post: SocialPost }>(`/api/social/post/${encodeURIComponent(postId)}`),
};
