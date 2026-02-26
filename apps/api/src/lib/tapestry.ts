import { PublicKey } from "@solana/web3.js";
import { env } from "../config.js";

type HttpMethod = "GET" | "POST" | "DELETE";

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
const forceMock = process.env.REVIVEPASS_FORCE_SOCIAL_MOCK === "1";
const hasRemoteConfig =
  process.env.NODE_ENV !== "test" &&
  Boolean(env.TAPESTRY_API_KEY) &&
  !env.TAPESTRY_API_KEY.toLowerCase().startsWith("replace-with");

const mockProfilesByWallet = new Map<string, TapestryProfile>();
const mockProfilesById = new Map<string, TapestryProfile>();
const mockPosts: TapestryPost[] = [];
const mockFollows = new Set<string>();

const mockId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

class TapestryHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string
  ) {
    super(message);
    this.name = "TapestryHttpError";
  }
}

const getBaseCandidates = () => {
  if (baseUrl.endsWith("/api/v1")) return [baseUrl];
  if (baseUrl.endsWith("/v1")) {
    return [baseUrl, baseUrl.replace(/\/v1$/, "/api/v1"), baseUrl.replace(/\/v1$/, "")];
  }
  if (baseUrl.endsWith("/api")) return [`${baseUrl}/v1`, baseUrl];
  return [`${baseUrl}/v1`, `${baseUrl}/api/v1`, baseUrl];
};

const appendApiKeyToPath = (path: string) => {
  if (!env.TAPESTRY_API_KEY) return path;
  if (/([?&])apiKey=/.test(path)) return path;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}apiKey=${encodeURIComponent(env.TAPESTRY_API_KEY)}`;
};

const extractErrorMessage = (data: unknown, status: number) => {
  if (typeof data === "object" && data !== null) {
    const typed = data as { message?: string; error?: string; details?: string };
    return typed.message ?? typed.error ?? typed.details ?? `Tapestry request failed (${status})`;
  }
  if (typeof data === "string" && data.trim()) return data;
  return `Tapestry request failed (${status})`;
};

const requestOnce = async <T>(
  endpointPath: string,
  method: HttpMethod,
  body?: unknown
): Promise<T> => {
  const path = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  const pathWithKey = appendApiKeyToPath(path);

  let lastError: TapestryHttpError | null = null;

  for (const candidateBase of getBaseCandidates()) {
    const url = `${candidateBase}${pathWithKey}`;
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${env.TAPESTRY_API_KEY}`,
        "x-api-key": env.TAPESTRY_API_KEY,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      return data as T;
    }

    const message = extractErrorMessage(data, response.status);
    lastError = new TapestryHttpError(message, response.status, url);
    if (response.status !== 404) {
      throw lastError;
    }
  }

  if (lastError) throw lastError;
  throw new Error("Tapestry request failed");
};

const requestAny = async <T>(
  paths: string[],
  method: HttpMethod,
  body?: unknown
): Promise<T> => {
  let lastError: Error | null = null;

  for (const path of paths) {
    try {
      return await requestOnce<T>(path, method, body);
    } catch (error) {
      const typed = error as TapestryHttpError;
      lastError = typed;
      if (!(typed instanceof TapestryHttpError) || typed.status !== 404) {
        throw typed;
      }
    }
  }

  if (lastError) throw lastError;
  throw new Error("Tapestry request failed");
};

const withRemoteFallback = async <T>(
  remoteFn: () => Promise<T>,
  mockFn: () => T | Promise<T>
): Promise<T> => {
  if (forceMock) {
    return await mockFn();
  }
  if (!hasRemoteConfig) {
    throw new Error(
      "Tapestry API is not configured. Set TAPESTRY_API_URL and TAPESTRY_API_KEY, or set REVIVEPASS_FORCE_SOCIAL_MOCK=1 for local mock mode."
    );
  }
  return await remoteFn();
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
  id:
    (raw as Partial<TapestryProfile> & { profileId?: string; _id?: string }).id ??
    (raw as Partial<TapestryProfile> & { profileId?: string; _id?: string }).profileId ??
    (raw as Partial<TapestryProfile> & { profileId?: string; _id?: string })._id ??
    mockId("profile"),
  walletAddress:
    (raw as Partial<TapestryProfile> & { wallet?: string; wallet_address?: string }).walletAddress ??
    (raw as Partial<TapestryProfile> & { wallet?: string; wallet_address?: string }).wallet ??
    (raw as Partial<TapestryProfile> & { wallet?: string; wallet_address?: string }).wallet_address ??
    "",
  handle:
    (raw as Partial<TapestryProfile> & { username?: string; name?: string }).handle ??
    (raw as Partial<TapestryProfile> & { username?: string; name?: string }).username ??
    (raw as Partial<TapestryProfile> & { username?: string; name?: string }).name ??
    "unknown",
  bio: (raw as Partial<TapestryProfile> & { description?: string }).bio ??
    (raw as Partial<TapestryProfile> & { description?: string }).description ??
    "",
  avatarUrl:
    (raw as Partial<TapestryProfile> & { avatar?: string }).avatarUrl ??
    (raw as Partial<TapestryProfile> & { avatar?: string }).avatar,
  followers: Number(
    (raw as Partial<TapestryProfile> & { followersCount?: number }).followers ??
      (raw as Partial<TapestryProfile> & { followersCount?: number }).followersCount ??
      0
  ),
  following: Number(
    (raw as Partial<TapestryProfile> & { followingCount?: number }).following ??
      (raw as Partial<TapestryProfile> & { followingCount?: number }).followingCount ??
      0
  ),
  source: "tapestry",
});

const mapRemotePost = (raw: Partial<TapestryPost>): TapestryPost => ({
  id:
    (raw as Partial<TapestryPost> & { contentId?: string; _id?: string }).id ??
    (raw as Partial<TapestryPost> & { contentId?: string; _id?: string }).contentId ??
    (raw as Partial<TapestryPost> & { contentId?: string; _id?: string })._id ??
    mockId("post"),
  profileId:
    (raw as Partial<TapestryPost> & { authorId?: string; author?: { id?: string } }).profileId ??
    (raw as Partial<TapestryPost> & { authorId?: string; author?: { id?: string } }).authorId ??
    (raw as Partial<TapestryPost> & { authorId?: string; author?: { id?: string } }).author?.id ??
    "unknown",
  authorHandle:
    (raw as Partial<TapestryPost> & {
      author?: { handle?: string; username?: string; name?: string };
    }).authorHandle ??
    (raw as Partial<TapestryPost> & {
      author?: { handle?: string; username?: string; name?: string };
    }).author?.handle ??
    (raw as Partial<TapestryPost> & {
      author?: { handle?: string; username?: string; name?: string };
    }).author?.username ??
    (raw as Partial<TapestryPost> & {
      author?: { handle?: string; username?: string; name?: string };
    }).author?.name ??
    "member",
  authorAvatarUrl:
    (raw as Partial<TapestryPost> & { author?: { avatarUrl?: string; avatar?: string } })
      .authorAvatarUrl ??
    (raw as Partial<TapestryPost> & { author?: { avatarUrl?: string; avatar?: string } }).author
      ?.avatarUrl ??
    (raw as Partial<TapestryPost> & { author?: { avatarUrl?: string; avatar?: string } }).author
      ?.avatar,
  content:
    (raw as Partial<TapestryPost> & { text?: string; body?: string }).content ??
    (raw as Partial<TapestryPost> & { text?: string; body?: string }).text ??
    (raw as Partial<TapestryPost> & { text?: string; body?: string }).body ??
    "",
  migrationSlug:
    (raw as Partial<TapestryPost> & {
      customProperties?: { migrationSlug?: string };
    }).migrationSlug ??
    (raw as Partial<TapestryPost> & {
      customProperties?: { migrationSlug?: string };
    }).customProperties?.migrationSlug,
  tags: normalizeTags(
    (raw as Partial<TapestryPost> & {
      customProperties?: { tags?: string[] };
    }).tags ??
      (raw as Partial<TapestryPost> & {
        customProperties?: { tags?: string[] };
      }).customProperties?.tags
  ),
  likes: Number(
    (raw as Partial<TapestryPost> & { likesCount?: number; likeCount?: number }).likes ??
      (raw as Partial<TapestryPost> & { likesCount?: number; likeCount?: number }).likesCount ??
      (raw as Partial<TapestryPost> & { likesCount?: number; likeCount?: number }).likeCount ??
      0
  ),
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
  const mockCreateOrGetProfile = () => {
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
  };

  return withRemoteFallback(
    async () => {
      const payload = await requestAny<
        Partial<TapestryProfile> | { profile?: Partial<TapestryProfile> } | { data?: Partial<TapestryProfile> }
      >(["/profiles/findOrCreate", "/profiles/find-or-create"], "POST", {
        walletAddress,
        handle,
        bio,
        avatarUrl,
      });
      const profile =
        (payload as { profile?: Partial<TapestryProfile> }).profile ??
        (payload as { data?: Partial<TapestryProfile> }).data ??
        (payload as Partial<TapestryProfile>);
      return mapRemoteProfile(profile);
    },
    mockCreateOrGetProfile
  );
};

export const followUser = async (currentUserId: string, targetUserId: string) => {
  const mockFollowUser = () => {
    mockFollows.add(`${currentUserId}:${targetUserId}`);
    const current = mockProfilesById.get(currentUserId);
    const target = mockProfilesById.get(targetUserId);
    return {
      ok: true,
      source: "mock" as const,
      currentUser: current ? hydrateFollowerStats(current) : null,
      targetUser: target ? hydrateFollowerStats(target) : null,
    };
  };

  return withRemoteFallback(
    () =>
      requestAny<{ ok?: boolean; success?: boolean }>(
        ["/followers", "/relationships/follow"],
        "POST",
        {
          currentUserId,
          targetUserId,
          followerProfileId: currentUserId,
          followingProfileId: targetUserId,
        }
      ),
    mockFollowUser
  );
};

export const unfollowUser = async (currentUserId: string, targetUserId: string) => {
  const mockUnfollowUser = () => {
    mockFollows.delete(`${currentUserId}:${targetUserId}`);
    const current = mockProfilesById.get(currentUserId);
    const target = mockProfilesById.get(targetUserId);
    return {
      ok: true,
      source: "mock" as const,
      currentUser: current ? hydrateFollowerStats(current) : null,
      targetUser: target ? hydrateFollowerStats(target) : null,
    };
  };

  return withRemoteFallback(
    () =>
      requestAny<{ ok?: boolean; success?: boolean }>(
        ["/followers", "/relationships/unfollow"],
        "DELETE",
        {
          currentUserId,
          targetUserId,
          followerProfileId: currentUserId,
          followingProfileId: targetUserId,
        }
      ),
    mockUnfollowUser
  );
};

export const createPost = async ({ profileId, content, migrationSlug, tags }: CreatePostInput) => {
  const normalizedTags = normalizeTags(tags);

  const mockCreatePost = () => {
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
  };

  return withRemoteFallback(
    async () => {
      const payload = await requestAny<
        Partial<TapestryPost> | { content?: Partial<TapestryPost> } | { post?: Partial<TapestryPost> } | { data?: Partial<TapestryPost> }
      >(["/contents/create", "/contents", "/posts"], "POST", {
        profileId,
        content,
        text: content,
        migrationSlug,
        tags: normalizedTags,
        customProperties: {
          tags: normalizedTags,
          migrationSlug,
        },
      });
      const post =
        (payload as { content?: Partial<TapestryPost> }).content ??
        (payload as { post?: Partial<TapestryPost> }).post ??
        (payload as { data?: Partial<TapestryPost> }).data ??
        (payload as Partial<TapestryPost>);
      return mapRemotePost(post);
    },
    mockCreatePost
  );
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
  const mockLikePost = () => {
    const post = mockPosts.find((entry) => entry.id === postId);
    if (post) post.likes += 1;
    return { ok: true, likes: post?.likes ?? 0, source: "mock" as const };
  };

  return withRemoteFallback(
    () =>
      requestAny<{ ok?: boolean; likes?: number; count?: number }>(
        [`/likes`, `/posts/${postId}/likes`],
        "POST",
        {
          postId,
          contentId: postId,
        }
      ),
    mockLikePost
  );
};

export const commentOnPost = async (postId: string, comment: string, profileId?: string) => {
  const mockCommentOnPost = () => {
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
  };

  return withRemoteFallback(
    async () => {
      const payload = await requestAny<TapestryComment | { comment?: TapestryComment }>(
        ["/comments", `/posts/${postId}/comments`],
        "POST",
        {
          postId,
          contentId: postId,
          comment,
          profileId,
        }
      );
      return (payload as { comment?: TapestryComment }).comment ?? (payload as TapestryComment);
    },
    mockCommentOnPost
  );
};

export const getPostById = async (postId: string) => {
  const mockGetPostById = () => {
    return mockPosts.find((entry) => entry.id === postId) ?? null;
  };

  return withRemoteFallback(
    async () => {
      const payload = await requestAny<
        Partial<TapestryPost> | { content?: Partial<TapestryPost> } | { post?: Partial<TapestryPost> }
      >([`/contents/${postId}`, `/posts/${postId}`], "GET");
      const post =
        (payload as { content?: Partial<TapestryPost> }).content ??
        (payload as { post?: Partial<TapestryPost> }).post ??
        (payload as Partial<TapestryPost>);
      return mapRemotePost(post);
    },
    mockGetPostById
  );
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
  const mockGetFeed = () => {
    const filtered = applyFeedFilter(mockPosts, options);
    return filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 50);
  };

  return withRemoteFallback(
    async () => {
      const query = new URLSearchParams();
      if (options.profileId) query.set("profileId", options.profileId);
      if (options.tag) query.set("tag", options.tag);
      if (options.query) query.set("query", options.query);

      const suffix = query.size > 0 ? `?${query.toString()}` : "";
      const payload = await requestAny<
        Partial<TapestryPost>[] | { feed?: Partial<TapestryPost>[] } | { contents?: Partial<TapestryPost>[] } | { data?: Partial<TapestryPost>[] } | { items?: Partial<TapestryPost>[] }
      >(
        [`/contents${suffix}`, `/feed${suffix}`],
        "GET"
      );

      const normalizedPayload = Array.isArray(payload)
        ? null
        : (payload as {
            feed?: Partial<TapestryPost>[];
            contents?: Partial<TapestryPost>[];
            data?: Partial<TapestryPost>[];
            items?: Partial<TapestryPost>[];
          });
      const list = Array.isArray(payload)
        ? payload
        : normalizedPayload?.feed ??
          normalizedPayload?.contents ??
          normalizedPayload?.data ??
          normalizedPayload?.items ??
          [];
      return applyFeedFilter(list.map(mapRemotePost), options);
    },
    mockGetFeed
  );
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
