import { env } from "../config.js";

type HttpMethod = "GET" | "POST";

type TapestryProfile = {
  id: string;
  walletAddress: string;
  handle: string;
  bio: string;
  source: "tapestry" | "mock";
};

type TapestryPost = {
  id: string;
  profileId: string;
  content: string;
  migrationSlug?: string;
  likes: number;
  comments: { id: string; postId: string; comment: string }[];
  createdAt: string;
  source: "tapestry" | "mock";
};

const baseUrl = env.TAPESTRY_API_URL.replace(/\/$/, "");
const hasApiKey =
  Boolean(env.TAPESTRY_API_KEY) &&
  !env.TAPESTRY_API_KEY.toLowerCase().startsWith("replace-with");

const mockProfiles = new Map<string, TapestryProfile>();
const mockPosts: TapestryPost[] = [];
const mockFollows = new Set<string>();

const mockId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const request = async <T>(path: string, method: HttpMethod, body?: unknown): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.TAPESTRY_API_KEY}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as
    | T
    | { message?: string; error?: string };

  if (!response.ok) {
    const message =
      (data as { message?: string; error?: string }).message ??
      (data as { message?: string; error?: string }).error ??
      `Tapestry request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
};

export const createOrGetProfile = async (walletAddress: string, handle?: string, bio?: string) => {
  if (!hasApiKey) {
    const current = mockProfiles.get(walletAddress);
    if (current) {
      return { ...current, handle: handle ?? current.handle, bio: bio ?? current.bio };
    }
    const profile: TapestryProfile = {
      id: mockId("profile"),
      walletAddress,
      handle: handle ?? `revive_${walletAddress.slice(0, 4).toLowerCase()}`,
      bio: bio ?? "RevivePass member",
      source: "mock",
    };
    mockProfiles.set(walletAddress, profile);
    return profile;
  }

  return request<TapestryProfile>("/profiles/find-or-create", "POST", {
    walletAddress,
    handle,
    bio,
  });
};

export const followUser = async (currentUserId: string, targetUserId: string) => {
  if (!hasApiKey) {
    mockFollows.add(`${currentUserId}:${targetUserId}`);
    return { ok: true, source: "mock" as const };
  }
  return request<{ ok: boolean }>("/relationships/follow", "POST", {
    currentUserId,
    targetUserId,
  });
};

export const unfollowUser = async (currentUserId: string, targetUserId: string) => {
  if (!hasApiKey) {
    mockFollows.delete(`${currentUserId}:${targetUserId}`);
    return { ok: true, source: "mock" as const };
  }
  return request<{ ok: boolean }>("/relationships/unfollow", "POST", {
    currentUserId,
    targetUserId,
  });
};

export const postMigrationAnnouncement = async (profileId: string, migrationSlug: string) => {
  const content = `Migration completed on RevivePass for ${migrationSlug}.`;

  if (!hasApiKey) {
    const post: TapestryPost = {
      id: mockId("post"),
      profileId,
      content,
      migrationSlug,
      likes: 0,
      comments: [],
      createdAt: new Date().toISOString(),
      source: "mock",
    };
    mockPosts.unshift(post);
    return post;
  }

  return request<TapestryPost>("/posts", "POST", {
    profileId,
    content,
    migrationSlug,
  });
};

export const likePost = async (postId: string) => {
  if (!hasApiKey) {
    const post = mockPosts.find((entry) => entry.id === postId);
    if (post) {
      post.likes += 1;
    }
    return { ok: true, likes: post?.likes ?? 0, source: "mock" as const };
  }
  return request<{ ok: boolean; likes: number }>(`/posts/${postId}/likes`, "POST");
};

export const commentOnPost = async (postId: string, comment: string) => {
  if (!hasApiKey) {
    const post = mockPosts.find((entry) => entry.id === postId);
    const payload = { id: mockId("comment"), postId, comment };
    if (post) {
      post.comments.push(payload);
    }
    return { ...payload, source: "mock" as const };
  }
  return request<{ id: string; postId: string; comment: string }>(`/posts/${postId}/comments`, "POST", {
    comment,
  });
};

export const getFeed = async (profileId?: string) => {
  if (!hasApiKey) {
    if (!profileId) {
      return mockPosts.slice(0, 25);
    }
    return mockPosts.filter((entry) => entry.profileId === profileId).slice(0, 25);
  }

  const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : "";
  return request<TapestryPost[]>(`/feed${query}`, "GET");
};
