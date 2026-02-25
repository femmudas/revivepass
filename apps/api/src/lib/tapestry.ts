import { PublicKey } from "@solana/web3.js";
import { env } from "../config.js";

type HttpMethod = "GET" | "POST";

export type TapestryProfile = {
  id: string;
  walletAddress: string;
  handle: string;
  bio: string;
  avatarUrl?: string;
  followers: number;
  following: number;
  source: "tapestry" | "mock";
};

export type TapestryComment = {
  id: string;
  postId: string;
  profileId?: string;
  comment: string;
  createdAt: string;
};

export type TapestryPost = {
  id: string;
  profileId: string;
  authorHandle: string;
  authorAvatarUrl?: string;
  content: string;
  migrationSlug?: string;
  tags: string[];
  likes: number;
  comments: TapestryComment[];
  createdAt: string;
  source: "tapestry" | "mock";
};

export type MergeAddressesResult = {
  merged: string[];
  invalid: string[];
  duplicatesIgnored: number;
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

const baseUrl = env.TAPESTRY_API_URL.replace(/\/$/, "");
const isRemoteEnabled = () =>
  process.env.REVIVEPASS_FORCE_SOCIAL_MOCK !== "1" &&
  process.env.NODE_ENV !== "test" &&
  Boolean(env.TAPESTRY_API_KEY) &&
  !env.TAPESTRY_API_KEY.toLowerCase().startsWith("replace-with");

const mockProfilesByWallet = new Map<string, TapestryProfile>();
const mockProfilesById = new Map<string, TapestryProfile>();
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

const normalizeTags = (tags?: string[]) =>
  (tags ?? [])
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

export const normalizeWalletAddress = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new PublicKey(trimmed).toBase58();
  } catch {
    return null;
  }
};

export const mergeAddresses = (csvAddresses: string[], manualAddresses: string[]): MergeAddressesResult => {
  const merged: string[] = [];
  const invalid: string[] = [];
  let duplicatesIgnored = 0;
  const seen = new Set<string>();

  for (const raw of [...csvAddresses, ...manualAddresses]) {
    const normalized = normalizeWalletAddress(raw);
    if (!normalized) {
      if (raw.trim()) invalid.push(raw.trim());
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      duplicatesIgnored += 1;
      continue;
    }
    seen.add(key);
    merged.push(normalized);
  }

  return { merged, invalid, duplicatesIgnored };
};

const hydrateFollowerStats = (profile: TapestryProfile): TapestryProfile => {
  const following = [...mockFollows].filter((entry) => entry.startsWith(`${profile.id}:`)).length;
  const followers = [...mockFollows].filter((entry) => entry.endsWith(`:${profile.id}`)).length;
  return { ...profile, following, followers };
};

const saveProfile = (profile: TapestryProfile) => {
  mockProfilesByWallet.set(profile.walletAddress, profile);
  mockProfilesById.set(profile.id, profile);
  return hydrateFollowerStats(profile);
};

const mapRemoteProfile = (raw: Partial<TapestryProfile>): TapestryProfile => ({
  id: raw.id ?? mockId("profile"),
  walletAddress: raw.walletAddress ?? "",
  handle: raw.handle ?? "unknown",
  bio: raw.bio ?? "",
  avatarUrl: raw.avatarUrl,
  followers: Number(raw.followers ?? 0),
  following: Number(raw.following ?? 0),
  source: "tapestry",
});

const mapRemotePost = (raw: Partial<TapestryPost>): TapestryPost => ({
  id: raw.id ?? mockId("post"),
  profileId: raw.profileId ?? "unknown",
  authorHandle: raw.authorHandle ?? "member",
  authorAvatarUrl: raw.authorAvatarUrl,
  content: raw.content ?? "",
  migrationSlug: raw.migrationSlug,
  tags: normalizeTags(raw.tags),
  likes: Number(raw.likes ?? 0),
  comments: (raw.comments ?? []).map((entry) => ({
    id: entry.id,
    postId: entry.postId,
    profileId: entry.profileId,
    comment: entry.comment,
    createdAt: entry.createdAt,
  })),
  createdAt: raw.createdAt ?? new Date().toISOString(),
  source: "tapestry",
});

export const createOrGetProfile = async (
  walletAddress: string,
  handle?: string,
  bio?: string,
  avatarUrl?: string
) => {
  if (!isRemoteEnabled()) {
    const key = walletAddress.trim();
    const current = mockProfilesByWallet.get(key);
    if (current) {
      return saveProfile({
        ...current,
        handle: handle ?? current.handle,
        bio: bio ?? current.bio,
        avatarUrl: avatarUrl ?? current.avatarUrl,
      });
    }

    const profile: TapestryProfile = {
      id: mockId("profile"),
      walletAddress: key,
      handle: handle ?? `revive_${key.slice(0, 4).toLowerCase()}`,
      bio: bio ?? "RevivePass member",
      avatarUrl,
      followers: 0,
      following: 0,
      source: "mock",
    };
    return saveProfile(profile);
  }

  const profile = await request<Partial<TapestryProfile>>("/profiles/find-or-create", "POST", {
    walletAddress,
    handle,
    bio,
    avatarUrl,
  });
  return mapRemoteProfile(profile);
};

export const followUser = async (currentUserId: string, targetUserId: string) => {
  if (!isRemoteEnabled()) {
    mockFollows.add(`${currentUserId}:${targetUserId}`);
    const current = mockProfilesById.get(currentUserId);
    const target = mockProfilesById.get(targetUserId);
    return {
      ok: true,
      source: "mock" as const,
      currentUser: current ? hydrateFollowerStats(current) : null,
      targetUser: target ? hydrateFollowerStats(target) : null,
    };
  }
  return request<{ ok: boolean }>("/relationships/follow", "POST", {
    currentUserId,
    targetUserId,
  });
};

export const unfollowUser = async (currentUserId: string, targetUserId: string) => {
  if (!isRemoteEnabled()) {
    mockFollows.delete(`${currentUserId}:${targetUserId}`);
    const current = mockProfilesById.get(currentUserId);
    const target = mockProfilesById.get(targetUserId);
    return {
      ok: true,
      source: "mock" as const,
      currentUser: current ? hydrateFollowerStats(current) : null,
      targetUser: target ? hydrateFollowerStats(target) : null,
    };
  }
  return request<{ ok: boolean }>("/relationships/unfollow", "POST", {
    currentUserId,
    targetUserId,
  });
};

export const createPost = async ({ profileId, content, migrationSlug, tags }: CreatePostInput) => {
  const normalizedTags = normalizeTags(tags);

  if (!isRemoteEnabled()) {
    const author = mockProfilesById.get(profileId);
    const post: TapestryPost = {
      id: mockId("post"),
      profileId,
      authorHandle: author?.handle ?? "member",
      authorAvatarUrl: author?.avatarUrl,
      content,
      migrationSlug,
      tags: normalizedTags,
      likes: 0,
      comments: [],
      createdAt: new Date().toISOString(),
      source: "mock",
    };
    mockPosts.unshift(post);
    return post;
  }

  const post = await request<Partial<TapestryPost>>("/posts", "POST", {
    profileId,
    content,
    migrationSlug,
    tags: normalizedTags,
    customProperties: {
      tags: normalizedTags,
      migrationSlug,
    },
  });
  return mapRemotePost(post);
};

export const postMigrationAnnouncement = async (
  profileId: string,
  migrationSlug: string,
  tags: string[] = []
) =>
  createPost({
    profileId,
    migrationSlug,
    content: `Migration completed on RevivePass for ${migrationSlug}.`,
    tags: ["migration", migrationSlug, ...tags],
  });

export const likePost = async (postId: string) => {
  if (!isRemoteEnabled()) {
    const post = mockPosts.find((entry) => entry.id === postId);
    if (post) post.likes += 1;
    return { ok: true, likes: post?.likes ?? 0, source: "mock" as const };
  }
  return request<{ ok: boolean; likes: number }>(`/posts/${postId}/likes`, "POST");
};

export const commentOnPost = async (postId: string, comment: string, profileId?: string) => {
  if (!isRemoteEnabled()) {
    const post = mockPosts.find((entry) => entry.id === postId);
    const payload: TapestryComment = {
      id: mockId("comment"),
      postId,
      profileId,
      comment,
      createdAt: new Date().toISOString(),
    };
    if (post) post.comments.push(payload);
    return { ...payload, source: "mock" as const };
  }
  return request<TapestryComment>(`/posts/${postId}/comments`, "POST", {
    comment,
    profileId,
  });
};

export const getPostById = async (postId: string) => {
  if (!isRemoteEnabled()) {
    return mockPosts.find((entry) => entry.id === postId) ?? null;
  }
  const post = await request<Partial<TapestryPost>>(`/posts/${postId}`, "GET");
  return mapRemotePost(post);
};

const applyFeedFilter = (input: TapestryPost[], options: FeedOptions) => {
  const query = options.query?.trim().toLowerCase() ?? "";
  const tag = options.tag?.trim().toLowerCase() ?? "";

  return input.filter((post) => {
    if (options.profileId && post.profileId !== options.profileId) return false;
    if (tag && !post.tags.includes(tag)) return false;
    if (!query) return true;
    const searchable = `${post.content} ${post.tags.join(" ")}`.toLowerCase();
    return searchable.includes(query);
  });
};

export const getFeed = async (options: FeedOptions = {}) => {
  if (!isRemoteEnabled()) {
    const filtered = applyFeedFilter(mockPosts, options);
    return filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 50);
  }

  const query = new URLSearchParams();
  if (options.profileId) query.set("profileId", options.profileId);
  if (options.tag) query.set("tag", options.tag);
  if (options.query) query.set("query", options.query);

  const data = await request<Partial<TapestryPost>[]>(
    `/feed${query.size > 0 ? `?${query.toString()}` : ""}`,
    "GET"
  );
  return applyFeedFilter(data.map(mapRemotePost), options);
};

export const getTrendingPosts = async (namespace = "default", limit = 8) => {
  const source = await getFeed();
  const now = Date.now();
  const ranked = source
    .map((post) => {
      const ageHours = Math.max(1, (now - Date.parse(post.createdAt)) / (1000 * 60 * 60));
      const score = post.likes * 100 + Math.max(0, 72 - ageHours);
      return { ...post, namespace, score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, Math.max(1, limit));
};

export const searchPosts = async (namespace = "default", query: string) => {
  const posts = await getFeed({ query });
  return posts.map((entry) => ({ ...entry, namespace }));
};

export const __resetMockSocialState = () => {
  mockProfilesByWallet.clear();
  mockProfilesById.clear();
  mockFollows.clear();
  mockPosts.splice(0, mockPosts.length);
};
