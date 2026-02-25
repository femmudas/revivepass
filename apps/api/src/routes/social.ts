import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createPost,
  commentOnPost,
  createOrGetProfile,
  followUser,
  getFeed,
  getPostById,
  getTrendingPosts,
  likePost,
  postMigrationAnnouncement,
  searchPosts,
  unfollowUser,
} from "../lib/tapestry.js";

const profileSchema = z.object({
  walletAddress: z.string().min(32).max(64),
  handle: z.string().min(2).max(32).optional(),
  bio: z.string().max(280).optional(),
});

const followSchema = z.object({
  currentUserId: z.string().min(3),
  targetUserId: z.string().min(3),
});

const postSchema = z.object({
  profileId: z.string().min(3),
  migrationSlug: z.string().min(3).optional(),
  content: z.string().min(1).max(1000).optional(),
  tags: z.array(z.string().min(1).max(32)).max(8).optional(),
}).refine(
  (value) => Boolean(value.migrationSlug || value.content),
  { message: "migrationSlug or content is required" }
);

const likeSchema = z.object({
  postId: z.string().min(3),
});

const commentSchema = z.object({
  postId: z.string().min(3),
  comment: z.string().min(1).max(280),
  profileId: z.string().min(3).optional(),
});

const feedQuerySchema = z.object({
  profileId: z.string().min(3).optional(),
  tag: z.string().min(1).max(32).optional(),
  query: z.string().min(1).max(120).optional(),
});

const trendingQuerySchema = z.object({
  namespace: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

const searchQuerySchema = z.object({
  namespace: z.string().min(1).max(64).optional(),
  query: z.string().min(1).max(120),
});

export const registerSocialRoutes = async (app: FastifyInstance) => {
  app.post("/api/social/profile", async (request, reply) => {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const profile = await createOrGetProfile(
        parsed.data.walletAddress,
        parsed.data.handle,
        parsed.data.bio
      );
      return { profile };
    } catch (error) {
      request.log.error(error, "Social profile create/find failed");
      return reply.status(502).send({ error: (error as Error).message });
    }
  });

  app.post("/api/social/follow", async (request, reply) => {
    const parsed = followSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      return await followUser(parsed.data.currentUserId, parsed.data.targetUserId);
    } catch (error) {
      request.log.error(error, "Social follow failed");
      return reply.status(502).send({ error: (error as Error).message });
    }
  });

  app.post("/api/social/unfollow", async (request, reply) => {
    const parsed = followSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      return await unfollowUser(parsed.data.currentUserId, parsed.data.targetUserId);
    } catch (error) {
      request.log.error(error, "Social unfollow failed");
      return reply.status(502).send({ error: (error as Error).message });
    }
  });

  app.post("/api/social/post", async (request, reply) => {
    const parsed = postSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const post =
        parsed.data.content && parsed.data.content.trim().length > 0
          ? await createPost({
              profileId: parsed.data.profileId,
              content: parsed.data.content.trim(),
              migrationSlug: parsed.data.migrationSlug,
              tags: parsed.data.tags,
            })
          : await postMigrationAnnouncement(
              parsed.data.profileId,
              parsed.data.migrationSlug as string,
              parsed.data.tags
            );
      return { post };
    } catch (error) {
      request.log.error(error, "Social post failed");
      return reply.status(502).send({ error: (error as Error).message });
    }
  });

  app.post("/api/social/like", async (request, reply) => {
    const parsed = likeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      return await likePost(parsed.data.postId);
    } catch (error) {
      request.log.error(error, "Social like failed");
      return reply.status(502).send({ error: (error as Error).message });
    }
  });

  app.post("/api/social/comment", async (request, reply) => {
    const parsed = commentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const comment = await commentOnPost(
        parsed.data.postId,
        parsed.data.comment,
        parsed.data.profileId
      );
      return { comment };
    } catch (error) {
      request.log.error(error, "Social comment failed");
      return reply.status(502).send({ error: (error as Error).message });
    }
  });

  app.get("/api/social/feed", async (request, reply) => {
    const parsed = feedQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const feed = await getFeed({
        profileId: parsed.data.profileId,
        tag: parsed.data.tag,
        query: parsed.data.query,
      });
      return { feed };
    } catch (error) {
      request.log.error(error, "Social feed failed");
      return reply.status(502).send({ error: (error as Error).message });
    }
  });

  app.get("/api/social/trending", async (request, reply) => {
    const parsed = trendingQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const feed = await getTrendingPosts(
        parsed.data.namespace ?? "revivepass",
        parsed.data.limit ?? 8
      );
      return { feed };
    } catch (error) {
      request.log.error(error, "Social trending failed");
      return reply.status(502).send({ error: (error as Error).message });
    }
  });

  app.get("/api/social/search", async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const feed = await searchPosts(parsed.data.namespace ?? "revivepass", parsed.data.query);
      return { feed };
    } catch (error) {
      request.log.error(error, "Social search failed");
      return reply.status(502).send({ error: (error as Error).message });
    }
  });

  app.get("/api/social/post/:postId", async (request, reply) => {
    const params = z
      .object({
        postId: z.string().min(3),
      })
      .safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: params.error.flatten() });
    }

    try {
      const post = await getPostById(params.data.postId);
      if (!post) {
        return reply.status(404).send({ error: "Post not found" });
      }
      return { post };
    } catch (error) {
      request.log.error(error, "Social post detail failed");
      return reply.status(502).send({ error: (error as Error).message });
    }
  });
};
