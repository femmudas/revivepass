import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  commentOnPost,
  createOrGetProfile,
  followUser,
  getFeed,
  likePost,
  postMigrationAnnouncement,
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
  migrationSlug: z.string().min(3),
});

const likeSchema = z.object({
  postId: z.string().min(3),
});

const commentSchema = z.object({
  postId: z.string().min(3),
  comment: z.string().min(1).max(280),
});

const feedQuerySchema = z.object({
  profileId: z.string().min(3).optional(),
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
      const post = await postMigrationAnnouncement(parsed.data.profileId, parsed.data.migrationSlug);
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
      const comment = await commentOnPost(parsed.data.postId, parsed.data.comment);
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
      const feed = await getFeed(parsed.data.profileId);
      return { feed };
    } catch (error) {
      request.log.error(error, "Social feed failed");
      return reply.status(502).send({ error: (error as Error).message });
    }
  });
};
