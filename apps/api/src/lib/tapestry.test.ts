import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.REVIVEPASS_FORCE_SOCIAL_MOCK = "1";

const tapestry = await import("./tapestry.js");

const walletA = "8rN25w5ecRjT3hSLM2gFCQ8rLJiVn4A8L9jtrM7G7f1M";
const walletB = "7Fj6Y9n9cfrXMMQHzxkroYTsDWEvnM4Q4i6bY6QeJ8Hn";

test.beforeEach(() => {
  tapestry.__resetMockSocialState();
});

test("trending ranks highly liked recent posts first", async () => {
  const alice = await tapestry.createOrGetProfile(walletA, "alice", "alpha");
  const bob = await tapestry.createOrGetProfile(walletB, "bob", "beta");

  const postA = await tapestry.createPost({
    profileId: alice.id,
    content: "Migration alpha update",
    tags: ["alpha"],
  });
  const postB = await tapestry.createPost({
    profileId: bob.id,
    content: "Migration beta update",
    tags: ["beta"],
  });

  await tapestry.likePost(postB.id);
  await tapestry.likePost(postB.id);

  const trending = await tapestry.getTrendingPosts("revivepass", 2);
  assert.equal(trending.length, 2);
  assert.equal(trending[0]?.id, postB.id);
  assert.equal(trending[1]?.id, postA.id);
});

test("search and tag filter return matching posts", async () => {
  const alice = await tapestry.createOrGetProfile(walletA, "alice", "alpha");
  await tapestry.createPost({
    profileId: alice.id,
    content: "Shared migration checklist",
    tags: ["checklist", "revive"],
  });
  await tapestry.createPost({
    profileId: alice.id,
    content: "Community call recording",
    tags: ["media"],
  });

  const search = await tapestry.searchPosts("revivepass", "checklist");
  assert.equal(search.length, 1);
  assert.equal(search[0]?.tags.includes("checklist"), true);

  const tagFeed = await tapestry.getFeed({ tag: "media" });
  assert.equal(tagFeed.length, 1);
  assert.equal(tagFeed[0]?.tags.includes("media"), true);
});

test("comments are persisted on post detail", async () => {
  const alice = await tapestry.createOrGetProfile(walletA, "alice", "alpha");
  const post = await tapestry.createPost({
    profileId: alice.id,
    content: "Claim complete",
    tags: ["claim"],
  });

  await tapestry.commentOnPost(post.id, "Great move!", alice.id);
  const detail = await tapestry.getPostById(post.id);

  assert.ok(detail);
  assert.equal(detail?.comments.length, 1);
  assert.equal(detail?.comments[0]?.comment, "Great move!");
});
