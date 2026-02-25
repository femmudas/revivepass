"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  ArrowLeft,
  Compass,
  ExternalLink,
  Heart,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserPlus2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { socialApi, type SocialPost, type SocialProfile } from "@/lib/social";

const formatTime = (value: string) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const parseTags = (value: string) =>
  value
    .split(/[,\s]+/)
    .map((entry) => entry.replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

export default function SocialPage() {
  const { publicKey } = useWallet();
  const wallet = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);

  const [status, setStatus] = useState("Connect your wallet to continue.");
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  const [targetUserId, setTargetUserId] = useState("");
  const [followBusy, setFollowBusy] = useState(false);

  const [feed, setFeed] = useState<SocialPost[]>([]);
  const [trending, setTrending] = useState<SocialPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [feedBusy, setFeedBusy] = useState(false);
  const [trendingBusy, setTrendingBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  const [postContent, setPostContent] = useState("");
  const [postTags, setPostTags] = useState("");
  const [postMigrationSlug, setPostMigrationSlug] = useState("");
  const [postBusy, setPostBusy] = useState(false);

  const [commentByPost, setCommentByPost] = useState<Record<string, string>>({});
  const [commentBusyByPost, setCommentBusyByPost] = useState<Record<string, boolean>>({});

  const profileSummary = profile
    ? `${profile.handle} · ${profile.followers} followers · ${profile.following} following`
    : "No social profile yet";

  const refreshFeed = async () => {
    setFeedBusy(true);
    try {
      const response = query.trim()
        ? await socialApi.search(query.trim())
        : await socialApi.getFeed({ tag: selectedTag || undefined });

      const feedItems = selectedTag
        ? response.feed.filter((entry) => entry.tags.includes(selectedTag))
        : response.feed;

      setFeed(feedItems);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setFeedBusy(false);
    }
  };

  const refreshTrending = async () => {
    setTrendingBusy(true);
    try {
      const response = await socialApi.getTrending(6);
      setTrending(response.feed);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setTrendingBusy(false);
    }
  };

  useEffect(() => {
    void refreshFeed();
    void refreshTrending();
  }, []);

  useEffect(() => {
    void refreshFeed();
  }, [selectedTag]);

  const onCreateProfile = async () => {
    if (!wallet) {
      setStatus("Connect your wallet first.");
      return;
    }
    setProfileBusy(true);
    try {
      const response = await socialApi.createOrGetProfile(
        wallet,
        handle || undefined,
        bio || undefined,
        avatarUrl || undefined
      );
      setProfile(response.profile);
      setStatus(`Profile ready: ${response.profile.handle}`);
      await refreshFeed();
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setProfileBusy(false);
    }
  };

  const onFollow = async (mode: "follow" | "unfollow") => {
    if (!profile) {
      setStatus("Create your profile first.");
      return;
    }
    if (!targetUserId.trim()) {
      setStatus("Target profile id is required.");
      return;
    }
    setFollowBusy(true);
    try {
      if (mode === "follow") {
        await socialApi.follow(profile.id, targetUserId.trim());
      } else {
        await socialApi.unfollow(profile.id, targetUserId.trim());
      }
      const response = await socialApi.createOrGetProfile(wallet, profile.handle, profile.bio, profile.avatarUrl);
      setProfile(response.profile);
      setStatus(`${mode === "follow" ? "Followed" : "Unfollowed"} ${targetUserId.trim()}`);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setFollowBusy(false);
    }
  };

  const onPublishPost = async () => {
    if (!profile) {
      setStatus("Create your profile first.");
      return;
    }
    if (!postContent.trim()) {
      setStatus("Post content cannot be empty.");
      return;
    }
    setPostBusy(true);
    try {
      const created = await socialApi.createPost({
        profileId: profile.id,
        content: postContent.trim(),
        migrationSlug: postMigrationSlug.trim() || undefined,
        tags: parseTags(postTags),
      });
      setSelectedPost(created.post);
      setPostContent("");
      setPostTags("");
      setStatus("Post published.");
      await Promise.all([refreshFeed(), refreshTrending()]);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setPostBusy(false);
    }
  };

  const onPostAnnouncement = async () => {
    if (!profile) {
      setStatus("Create your profile first.");
      return;
    }
    if (!postMigrationSlug.trim()) {
      setStatus("Migration slug is required for announcement.");
      return;
    }
    setPostBusy(true);
    try {
      await socialApi.postMigration(profile.id, postMigrationSlug.trim());
      setStatus("Migration announcement published.");
      await Promise.all([refreshFeed(), refreshTrending()]);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setPostBusy(false);
    }
  };

  const onLike = async (postId: string) => {
    try {
      await socialApi.like(postId);
      await Promise.all([refreshFeed(), refreshTrending()]);
      if (selectedPost?.id === postId) {
        const detail = await socialApi.getPost(postId);
        setSelectedPost(detail.post);
      }
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const onComment = async (postId: string) => {
    const value = commentByPost[postId]?.trim();
    if (!value) {
      setStatus("Comment cannot be empty.");
      return;
    }
    setCommentBusyByPost((prev) => ({ ...prev, [postId]: true }));
    try {
      await socialApi.comment(postId, value, profile?.id);
      setCommentByPost((prev) => ({ ...prev, [postId]: "" }));
      await Promise.all([refreshFeed(), refreshTrending()]);
      if (selectedPost?.id === postId) {
        const detail = await socialApi.getPost(postId);
        setSelectedPost(detail.post);
      }
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setCommentBusyByPost((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const openDetail = async (postId: string) => {
    try {
      const detail = await socialApi.getPost(postId);
      setSelectedPost(detail.post);
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const post of [...feed, ...trending]) {
      for (const tag of post.tags) tags.add(tag);
    }
    return [...tags].slice(0, 16);
  }, [feed, trending]);

  const feedEmpty = !feedBusy && feed.length === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5 py-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Portal
            </Link>
          </Button>
          <Badge className="gap-1">
            <Compass className="h-3.5 w-3.5" />
            Tapestry Social
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/?page=dashboard">Dashboard</Link>
          </Button>
          <WalletMultiButton className="!h-10 !rounded-xl !border !border-border !bg-neon !px-4 !text-sm !font-semibold !text-background" />
        </div>
      </Card>

      <div className="rounded-xl border border-border bg-neon/10 px-4 py-3 text-sm text-muted">{status}</div>

      <div className="grid gap-5 lg:grid-cols-[360px,1fr]">
        <div className="space-y-5">
          <Card className="space-y-3">
            <CardTitle>Profile</CardTitle>
            <CardDescription>Create or update your social identity.</CardDescription>
            <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Handle" />
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Bio"
              className="min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-neon focus:ring-2 focus:ring-focus"
            />
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="Avatar URL (optional)"
            />
            <Button onClick={onCreateProfile} disabled={!wallet || profileBusy} className="w-full">
              {profileBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <UserRound className="mr-2 h-4 w-4" /> Save Profile
                </>
              )}
            </Button>
            <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted">
              {profileSummary}
            </div>
          </Card>

          <Card className="space-y-3">
            <CardTitle>Follow Users</CardTitle>
            <CardDescription>Use profile IDs to follow or unfollow accounts.</CardDescription>
            <Input
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="Target profile id"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={!profile || followBusy} onClick={() => onFollow("follow")}>
                <UserPlus2 className="mr-2 h-4 w-4" /> Follow
              </Button>
              <Button variant="outline" disabled={!profile || followBusy} onClick={() => onFollow("unfollow")}>
                Unfollow
              </Button>
            </div>
          </Card>

          <Card className="space-y-3">
            <CardTitle>Trending Now</CardTitle>
            <CardDescription>Popular updates ranked by recency and engagement.</CardDescription>
            <Button variant="outline" onClick={() => void refreshTrending()} disabled={trendingBusy} className="w-full">
              {trendingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh Trending
            </Button>
            <div className="space-y-2">
              {trending.slice(0, 4).map((post) => (
                <button
                  key={post.id}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-left text-xs text-muted hover:border-neon/60 hover:text-foreground"
                  onClick={() => void openDetail(post.id)}
                >
                  <div className="line-clamp-2">{post.content}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>@{post.authorHandle}</span>
                    <span>{post.likes} likes</span>
                  </div>
                </button>
              ))}
              {!trendingBusy && trending.length === 0 && (
                <p className="text-xs text-muted">No trending content yet.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="space-y-3">
            <CardTitle>Create Post</CardTitle>
            <CardDescription>Publish migration updates, tags, and announcements.</CardDescription>
            <textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="Share a migration update..."
              className="min-h-28 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-neon focus:ring-2 focus:ring-focus"
            />
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                value={postTags}
                onChange={(e) => setPostTags(e.target.value)}
                placeholder="Tags (comma or space separated)"
              />
              <Input
                value={postMigrationSlug}
                onChange={(e) => setPostMigrationSlug(e.target.value)}
                placeholder="Migration slug (optional)"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!profile || postBusy} onClick={onPublishPost}>
                {postBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Publish Post
              </Button>
              <Button variant="outline" disabled={!profile || postBusy} onClick={onPostAnnouncement}>
                <Sparkles className="mr-2 h-4 w-4" />
                Post Migration Announcement
              </Button>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search posts or tags"
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={() => void refreshFeed()} disabled={feedBusy}>
                {feedBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
              <Button variant="ghost" onClick={() => void refreshFeed()} disabled={feedBusy}>
                <RefreshCw className={`h-4 w-4 ${feedBusy ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className={`rounded-full border px-3 py-1 text-xs ${
                  selectedTag === ""
                    ? "border-neon bg-neon/15 text-neon"
                    : "border-border text-muted hover:border-neon/60"
                }`}
                onClick={() => setSelectedTag("")}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    selectedTag === tag
                      ? "border-neon bg-neon/15 text-neon"
                      : "border-border text-muted hover:border-neon/60"
                  }`}
                  onClick={() => setSelectedTag(tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </Card>

          <div className="space-y-3">
            {feedBusy && (
              <Card className="animate-pulse">
                <div className="h-4 w-1/3 rounded bg-neon/15" />
                <div className="mt-3 h-4 rounded bg-neon/10" />
                <div className="mt-2 h-4 w-5/6 rounded bg-neon/10" />
              </Card>
            )}

            {feedEmpty && (
              <Card>
                <CardDescription>
                  No posts matched your filters. Try publishing a new update or clear the search.
                </CardDescription>
              </Card>
            )}

            {!feedBusy &&
              feed.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <Card className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">@{post.authorHandle}</p>
                        <p className="text-xs text-muted">{formatTime(post.createdAt)}</p>
                      </div>
                      {post.source && <Badge className="text-[10px] uppercase">{post.source}</Badge>}
                    </div>

                    <p className="text-sm text-foreground">{post.content}</p>

                    <div className="flex flex-wrap gap-1.5">
                      {post.tags.map((tag) => (
                        <button
                          key={`${post.id}-${tag}`}
                          className="rounded-full border border-border px-2 py-0.5 text-xs text-muted hover:border-neon/60 hover:text-neon"
                          onClick={() => setSelectedTag(tag)}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" onClick={() => void onLike(post.id)}>
                        <Heart className="mr-2 h-4 w-4" />
                        {post.likes}
                      </Button>
                      <Button variant="outline" onClick={() => void openDetail(post.id)}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Details
                      </Button>
                      <Badge>{post.comments.length} comments</Badge>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={commentByPost[post.id] ?? ""}
                        onChange={(e) =>
                          setCommentByPost((prev) => ({
                            ...prev,
                            [post.id]: e.target.value,
                          }))
                        }
                        placeholder="Write a comment"
                      />
                      <Button
                        variant="outline"
                        onClick={() => void onComment(post.id)}
                        disabled={commentBusyByPost[post.id]}
                      >
                        {commentBusyByPost[post.id] ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <MessageSquare className="mr-2 h-4 w-4" />
                        )}
                        Comment
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
          </div>
        </div>
      </div>

      {selectedPost && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Post Detail</CardTitle>
              <CardDescription>
                @{selectedPost.authorHandle} · {formatTime(selectedPost.createdAt)}
              </CardDescription>
            </div>
            <Button variant="ghost" onClick={() => setSelectedPost(null)}>
              Close
            </Button>
          </div>
          <p className="text-sm text-foreground">{selectedPost.content}</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedPost.tags.map((tag) => (
              <Badge key={`detail-${selectedPost.id}-${tag}`}>#{tag}</Badge>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Comments</p>
            {selectedPost.comments.length === 0 && (
              <p className="text-sm text-muted">No comments yet.</p>
            )}
            {selectedPost.comments.map((commentItem) => (
              <div key={commentItem.id} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <p className="text-foreground">{commentItem.comment}</p>
                <p className="mt-1 text-xs text-muted">{formatTime(commentItem.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
