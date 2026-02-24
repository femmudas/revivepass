"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Heart, MessageSquare, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { socialApi, type SocialPost, type SocialProfile } from "@/lib/social";

export default function SocialPage() {
  const { publicKey } = useWallet();
  const wallet = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);

  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [followLoading, setFollowLoading] = useState(false);
  const [feed, setFeed] = useState<SocialPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [status, setStatus] = useState("Connect wallet to continue.");
  const [commentTextByPost, setCommentTextByPost] = useState<Record<string, string>>({});
  const [announcementSlug, setAnnouncementSlug] = useState("loyalty-campaign");

  const refreshFeed = async (profileId?: string) => {
    setFeedLoading(true);
    try {
      const response = await socialApi.getFeed(profileId);
      setFeed(response.feed);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    void refreshFeed();
  }, []);

  const createProfile = async () => {
    if (!wallet) {
      setStatus("Connect wallet first.");
      return;
    }
    try {
      const response = await socialApi.createOrGetProfile(wallet, handle || undefined, bio || undefined);
      setProfile(response.profile);
      setStatus(`Profile ready: ${response.profile.handle}`);
      await refreshFeed(response.profile.id);
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const follow = async (mode: "follow" | "unfollow") => {
    if (!profile || !targetUserId.trim()) {
      setStatus("Profile and target user id are required.");
      return;
    }
    setFollowLoading(true);
    try {
      if (mode === "follow") {
        await socialApi.follow(profile.id, targetUserId.trim());
      } else {
        await socialApi.unfollow(profile.id, targetUserId.trim());
      }
      setStatus(`${mode === "follow" ? "Followed" : "Unfollowed"} user ${targetUserId.trim()}.`);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setFollowLoading(false);
    }
  };

  const postAnnouncement = async () => {
    if (!profile) {
      setStatus("Create profile first.");
      return;
    }
    if (!announcementSlug.trim()) {
      setStatus("Migration slug is required.");
      return;
    }
    try {
      await socialApi.postMigration(profile.id, announcementSlug.trim());
      setStatus("Migration announcement published.");
      await refreshFeed(profile.id);
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const like = async (postId: string) => {
    try {
      await socialApi.like(postId);
      await refreshFeed(profile?.id);
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const comment = async (postId: string) => {
    const commentText = commentTextByPost[postId]?.trim();
    if (!commentText) {
      setStatus("Comment cannot be empty.");
      return;
    }
    try {
      await socialApi.comment(postId, commentText);
      setCommentTextByPost((prev) => ({ ...prev, [postId]: "" }));
      await refreshFeed(profile?.id);
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-5 py-6 lg:grid-cols-[360px,1fr]">
      <div className="space-y-5">
        <Card className="space-y-3">
          <CardTitle>Tapestry Social</CardTitle>
          <CardDescription>Create your on-chain profile and interact with migration posts.</CardDescription>
          <WalletMultiButton className="!bg-neon !text-background" />
        </Card>

        <Card className="space-y-3">
          <CardTitle>Create / Update Profile</CardTitle>
          <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Handle" />
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Bio"
            className="min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-neon focus:ring-2 focus:ring-focus"
          />
          <Button onClick={createProfile} disabled={!wallet}>
            <UserRound className="mr-2 h-4 w-4" /> Save Profile
          </Button>
          {profile && (
            <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted">
              Profile: {profile.handle} ({profile.id})
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <CardTitle>Follow / Unfollow</CardTitle>
          <Input
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            placeholder="Target profile id"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={followLoading || !profile} onClick={() => follow("follow")}>
              Follow
            </Button>
            <Button variant="outline" disabled={followLoading || !profile} onClick={() => follow("unfollow")}>
              Unfollow
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="space-y-3">
          <CardTitle>Migration Feed</CardTitle>
          <CardDescription>
            Publish migration announcements to Tapestry and engage with your community.
          </CardDescription>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={announcementSlug}
              onChange={(e) => setAnnouncementSlug(e.target.value)}
              placeholder="migration slug"
            />
            <Button onClick={postAnnouncement} disabled={!profile}>
              Post Announcement
            </Button>
            <Button variant="ghost" onClick={() => refreshFeed(profile?.id)}>
              <RefreshCw className={`h-4 w-4 ${feedLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <p className="text-sm text-muted">{status}</p>
        </Card>

        <div className="space-y-3">
          {feedLoading && (
            <Card className="animate-pulse">
              <div className="h-5 w-2/5 rounded bg-neon/15" />
              <div className="mt-2 h-4 w-full rounded bg-neon/10" />
            </Card>
          )}

          {!feedLoading && feed.length === 0 && (
            <Card>
              <CardDescription>No posts yet. Publish the first migration update.</CardDescription>
            </Card>
          )}

          {!feedLoading &&
            feed.map((post) => (
              <Card key={post.id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{post.content}</p>
                    <p className="text-xs text-muted">
                      {new Date(post.createdAt).toLocaleString()} · {post.source ?? "tapestry"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="default" onClick={() => like(post.id)}>
                    <Heart className="mr-2 h-4 w-4" />
                    {post.likes}
                  </Button>
                </div>

                <div className="space-y-2">
                  {post.comments.map((commentItem) => (
                    <div key={commentItem.id} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      {commentItem.comment}
                    </div>
                  ))}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={commentTextByPost[post.id] ?? ""}
                      onChange={(e) =>
                        setCommentTextByPost((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      placeholder="Write a comment"
                    />
                    <Button variant="outline" onClick={() => comment(post.id)}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Comment
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}
