import { apiRequest } from "./api";

export type SocialProfile = {
  id: string;
  walletAddress: string;
  handle: string;
  bio: string;
  source?: "tapestry" | "mock";
};

export type SocialPost = {
  id: string;
  profileId: string;
  content: string;
  migrationSlug?: string;
  likes: number;
  comments: { id: string; postId: string; comment: string }[];
  createdAt: string;
  source?: "tapestry" | "mock";
};

export const socialApi = {
  createOrGetProfile: (walletAddress: string, handle?: string, bio?: string) =>
    apiRequest<{ profile: SocialProfile }>("/api/social/profile", {
      method: "POST",
      body: { walletAddress, handle, bio },
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
  comment: (postId: string, comment: string) =>
    apiRequest<{ comment: { id: string; postId: string; comment: string } }>("/api/social/comment", {
      method: "POST",
      body: { postId, comment },
    }),
  getFeed: (profileId?: string) =>
    apiRequest<{ feed: SocialPost[] }>(
      profileId ? `/api/social/feed?profileId=${encodeURIComponent(profileId)}` : "/api/social/feed"
    ),
};
