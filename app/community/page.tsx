"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type Post = {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  userPhoto?: string;
  text?: string;
  imageUrl?: string;
  likes?: string[];
  commentsCount?: number;
  sharesCount?: number;
  createdAt?: any;
  updatedAt?: any;
};

type Comment = {
  id: string;
  postId?: string;
  userId?: string;
  userEmail?: string;
  text?: string;
  createdAt?: any;
};

type UserProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
  city?: string;
  state?: string;
  verified?: boolean;
  ratingAverage?: number;
  ratingCount?: number;
  followers?: string[];
  following?: string[];
  online?: boolean;
};

type ViewMode = "all" | "trending" | "mine";

export default function CommunityPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedPostId, setExpandedPostId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [status, setStatus] = useState("Loading community...");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserId("");
        setUserEmail("");
        setProfile(null);
        setStatus("Please sign in to view the community.");
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      setStatus("");

      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email || "",
          online: true,
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      unsubscribeProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          setProfile((snapshot.data() as UserProfile) || null);
        },
        (error) => setStatus(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [router]);

  useEffect(() => {
    const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const commentsQuery = query(collection(db, "comments"), orderBy("createdAt", "asc"));

    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Post[];

        setPosts(data);
        setStatus("");
      },
      (error) => setStatus(error.message)
    );

    const unsubscribeComments = onSnapshot(
      commentsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Comment[];

        setComments(data);
      },
      (error) => setStatus(error.message)
    );

    return () => {
      unsubscribePosts();
      unsubscribeComments();
    };
  }, []);

  const displayName = profile?.name || userEmail || "RoadLink Member";
  const displayPhoto = profile?.photoURL || "";
  const location =
    profile?.city || profile?.state
      ? `${profile.city || ""}${profile.city && profile.state ? ", " : ""}${profile.state || ""}`
      : "RoadLink Community";

  const visiblePosts = useMemo(() => {
    if (viewMode === "mine") {
      return posts.filter((post) => post.userId === userId);
    }

    if (viewMode === "trending") {
      return [...posts].sort((a, b) => {
        const aScore =
          Number(a.likes?.length || 0) +
          Number(a.commentsCount || 0) +
          Number(a.sharesCount || 0);
        const bScore =
          Number(b.likes?.length || 0) +
          Number(b.commentsCount || 0) +
          Number(b.sharesCount || 0);

        return bScore - aScore;
      });
    }

    return posts;
  }, [posts, userId, viewMode]);

  const totalLikes = posts.reduce((total, post) => total + Number(post.likes?.length || 0), 0);
  const totalComments = comments.length;
  const verifiedText = profile?.verified ? "Verified Member" : "RoadLink Member";

  function getDate(value?: any) {
    if (!value) return new Date();

    try {
      const date = value?.toDate ? value.toDate() : new Date(value);
      return Number.isNaN(date.getTime()) ? new Date() : date;
    } catch {
      return new Date();
    }
  }

  function formatTime(value?: any) {
    const date = getDate(value);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hr ago`;
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getPostComments(postId: string) {
    return comments.filter((comment) => comment.postId === postId);
  }

  async function createPost() {
    if (!userId) {
      setStatus("Please sign in first.");
      return;
    }

    if (!text.trim() && !imageUrl.trim()) {
      setStatus("Write something or add an image URL.");
      return;
    }

    try {
      setPosting(true);
      setStatus("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "posts"), {
        userId,
        userEmail,
        userName: displayName,
        userPhoto: displayPhoto,
        text: text.trim(),
        imageUrl: imageUrl.trim(),
        likes: [],
        commentsCount: 0,
        sharesCount: 0,
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId,
        type: "community",
        title: "Post Published",
        message: "Your community post was published.",
        read: false,
        createdAt: now,
        actionUrl: "/community",
      });

      setText("");
      setImageUrl("");
      setStatus("Post published.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not publish post.");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(post: Post) {
    if (!userId) {
      setStatus("Please sign in first.");
      return;
    }

    const likes = Array.isArray(post.likes) ? post.likes : [];
    const alreadyLiked = likes.includes(userId);
    const nextLikes = alreadyLiked
      ? likes.filter((id) => id !== userId)
      : [...likes, userId];

    try {
      await updateDoc(doc(db, "posts", post.id), {
        likes: nextLikes,
        updatedAt: new Date().toISOString(),
      });

      if (!alreadyLiked && post.userId && post.userId !== userId) {
        await addDoc(collection(db, "notifications"), {
          userId: post.userId,
          type: "community",
          title: "New Like",
          message: `${userEmail} liked your community post.`,
          read: false,
          createdAt: new Date().toISOString(),
          actionUrl: "/community",
        });
      }
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not update like.");
    }
  }

  async function addComment(post: Post) {
    if (!userId) {
      setStatus("Please sign in first.");
      return;
    }

    const value = commentInputs[post.id]?.trim() || "";

    if (!value) return;

    try {
      const now = new Date().toISOString();

      await addDoc(collection(db, "comments"), {
        postId: post.id,
        userId,
        userEmail,
        text: value,
        createdAt: now,
      });

      await updateDoc(doc(db, "posts", post.id), {
        commentsCount: Number(post.commentsCount || 0) + 1,
        updatedAt: now,
      });

      if (post.userId && post.userId !== userId) {
        await addDoc(collection(db, "notifications"), {
          userId: post.userId,
          type: "community",
          title: "New Comment",
          message: `${userEmail} commented on your post.`,
          read: false,
          createdAt: now,
          actionUrl: "/community",
        });
      }

      setCommentInputs((previous) => ({
        ...previous,
        [post.id]: "",
      }));

      setExpandedPostId(post.id);
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not add comment.");
    }
  }

  async function sharePost(post: Post) {
    try {
      await updateDoc(doc(db, "posts", post.id), {
        sharesCount: Number(post.sharesCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      });

      setStatus("Post shared inside RoadLink.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not share post.");
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="navButton">← Dashboard</Link>
          <Link href="/activity-feed" className="navButton">Activity Feed</Link>
          <Link href="/find-ride" className="navButton">Find Ride</Link>
          <Link href="/offer-ride" className="navButton">Offer Ride</Link>
          <Link href="/profile" className="navButton">Profile</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Social</p>
            <h1>Community <span>Feed</span></h1>
            <p className="subtitle">
              Share updates, connect with drivers and passengers, and build RoadLink community trust.
            </p>
          </div>

          <div className="liveOrb">
            <strong>LIVE</strong>
            <span>{posts.length} posts</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="layout">
          <aside className="sidePanel">
            <div className="profileCard">
              {displayPhoto ? (
                <img src={displayPhoto} alt={displayName} className="profilePhoto" />
              ) : (
                <div className="profileAvatar">{displayName.charAt(0).toUpperCase()}</div>
              )}

              <h2>{displayName}</h2>
              <p>{userEmail}</p>

              <div className="profileBadges">
                <span>{verifiedText}</span>
                <span>📍 {location}</span>
              </div>
            </div>

            <div className="miniStats">
              <Metric icon="📝" label="Posts" value={String(posts.length)} />
              <Metric icon="❤️" label="Likes" value={String(totalLikes)} />
              <Metric icon="💬" label="Comments" value={String(totalComments)} />
            </div>
          </aside>

          <section className="mainFeed">
            <section className="composer">
              <div className="composerTop">
                {displayPhoto ? (
                  <img src={displayPhoto} alt={displayName} className="smallPhoto" />
                ) : (
                  <div className="smallAvatar">{displayName.charAt(0).toUpperCase()}</div>
                )}

                <div>
                  <p className="eyebrow">Create Post</p>
                  <h2>Share with RoadLink</h2>
                </div>
              </div>

              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="What's happening in your RoadLink journey?"
              />

              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="Optional image URL..."
              />

              <button onClick={createPost} disabled={posting}>
                {posting ? "Publishing..." : "Publish Post"}
              </button>
            </section>

            <section className="filters">
              <button
                className={viewMode === "all" ? "activeFilter" : ""}
                onClick={() => setViewMode("all")}
              >
                🌎 All
              </button>

              <button
                className={viewMode === "trending" ? "activeFilter" : ""}
                onClick={() => setViewMode("trending")}
              >
                🔥 Trending
              </button>

              <button
                className={viewMode === "mine" ? "activeFilter" : ""}
                onClick={() => setViewMode("mine")}
              >
                👤 Mine
              </button>
            </section>

            {visiblePosts.length === 0 ? (
              <section className="empty">
                <div className="emptyIcon">🌎</div>
                <h3>No posts yet</h3>
                <p>Be the first to post in the RoadLink community.</p>
              </section>
            ) : (
              <div className="postList">
                {visiblePosts.map((post) => {
                  const likes = Array.isArray(post.likes) ? post.likes : [];
                  const liked = likes.includes(userId);
                  const postComments = getPostComments(post.id);
                  const expanded = expandedPostId === post.id;

                  return (
                    <article key={post.id} className="postCard">
                      <div className="postHeader">
                        {post.userPhoto ? (
                          <img src={post.userPhoto} alt={post.userName || "User"} className="smallPhoto" />
                        ) : (
                          <div className="smallAvatar">
                            {(post.userName || post.userEmail || "R").charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div>
                          <h3>{post.userName || post.userEmail || "RoadLink Member"}</h3>
                          <p>{formatTime(post.createdAt)}</p>
                        </div>
                      </div>

                      {post.text && <p className="postText">{post.text}</p>}

                      {post.imageUrl && (
                        <img src={post.imageUrl} alt="Community post" className="postImage" />
                      )}

                      <div className="postStats">
                        <span>❤️ {likes.length}</span>
                        <span>💬 {postComments.length}</span>
                        <span>🔁 {post.sharesCount || 0}</span>
                      </div>

                      <div className="postActions">
                        <button onClick={() => toggleLike(post)}>
                          {liked ? "❤️ Liked" : "🤍 Like"}
                        </button>

                        <button onClick={() => setExpandedPostId(expanded ? "" : post.id)}>
                          💬 Comment
                        </button>

                        <button onClick={() => sharePost(post)}>
                          🔁 Share
                        </button>
                      </div>

                      {expanded && (
                        <div className="commentsBox">
                          <div className="commentInput">
                            <input
                              value={commentInputs[post.id] || ""}
                              onChange={(event) =>
                                setCommentInputs((previous) => ({
                                  ...previous,
                                  [post.id]: event.target.value,
                                }))
                              }
                              placeholder="Write a comment..."
                            />

                            <button onClick={() => addComment(post)}>
                              Send
                            </button>
                          </div>

                          {postComments.length === 0 ? (
                            <p className="noComments">No comments yet.</p>
                          ) : (
                            postComments.map((comment) => (
                              <div key={comment.id} className="comment">
                                <strong>{comment.userEmail || "RoadLink User"}</strong>
                                <p>{comment.text}</p>
                                <small>{formatTime(comment.createdAt)}</small>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          padding: 24px;
          padding-bottom: 120px;
          color: white;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.25), transparent 35%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container {
          max-width: 1180px;
          margin: auto;
        }

        .topBar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }

        .navButton {
          color: white;
          text-decoration: none;
          font-weight: 900;
          padding: 12px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .hero,
        .sidePanel,
        .composer,
        .postCard,
        .empty,
        .metric,
        .filters {
          background: rgba(8,13,25,0.9);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          padding: 35px;
          border-radius: 32px;
          margin-bottom: 20px;
        }

        .eyebrow {
          color: #22c55e;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 13px;
          margin: 0 0 10px;
        }

        h1 {
          margin: 0 0 16px;
          font-size: 60px;
          line-height: 1;
        }

        h1 span,
        h2,
        .metricValue,
        .liveOrb strong {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          max-width: 680px;
          line-height: 1.5;
          font-size: 18px;
          margin: 0;
        }

        .liveOrb {
          min-width: 120px;
          height: 120px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          justify-content: center;
          align-items: center;
          flex-direction: column;
        }

        .status {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }

        .layout {
          display: grid;
          grid-template-columns: 310px 1fr;
          gap: 20px;
          align-items: start;
        }

        .sidePanel {
          border-radius: 30px;
          padding: 24px;
          position: sticky;
          top: 20px;
        }

        .profileCard {
          text-align: center;
          margin-bottom: 18px;
        }

        .profilePhoto,
        .profileAvatar {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          margin: 0 auto 14px;
          border: 2px solid rgba(34,197,94,0.45);
        }

        .profilePhoto {
          object-fit: cover;
        }

        .profileAvatar,
        .smallAvatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
        }

        .profileAvatar {
          font-size: 40px;
        }

        .profileCard h2 {
          margin: 0 0 6px;
          overflow-wrap: anywhere;
        }

        .profileCard p {
          color: #a1a1aa;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .profileBadges {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          margin-top: 14px;
        }

        .profileBadges span {
          padding: 8px 10px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-size: 12px;
          font-weight: 900;
        }

        .miniStats {
          display: grid;
          gap: 10px;
        }

        .metric {
          box-shadow: none;
          padding: 16px;
          border-radius: 18px;
        }

        .metricIcon {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .metricValue {
          font-size: 24px;
          font-weight: 900;
        }

        .composer {
          border-radius: 30px;
          padding: 24px;
          margin-bottom: 16px;
        }

        .composerTop,
        .postHeader {
          display: flex;
          gap: 14px;
          align-items: center;
          margin-bottom: 16px;
        }

        .smallPhoto,
        .smallAvatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .smallPhoto {
          object-fit: cover;
          border: 1px solid rgba(34,197,94,0.45);
        }

        .smallAvatar {
          font-size: 20px;
        }

        .composer h2 {
          margin: 0;
        }

        textarea,
        input {
          width: 100%;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          padding: 15px;
          font-size: 16px;
          outline: none;
          font-family: Arial, sans-serif;
        }

        textarea {
          min-height: 120px;
          resize: vertical;
          margin-bottom: 12px;
        }

        input {
          margin-bottom: 12px;
        }

        .composer button,
        .postActions button,
        .commentInput button {
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          padding: 13px 18px;
          cursor: pointer;
        }

        .composer button {
          width: 100%;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .filters {
          border-radius: 24px;
          padding: 12px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 16px;
          box-shadow: none;
        }

        .filters button {
          padding: 13px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .filters .activeFilter {
          color: #22c55e;
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.12);
        }

        .postList {
          display: grid;
          gap: 16px;
        }

        .postCard {
          border-radius: 28px;
          padding: 24px;
        }

        .postHeader h3 {
          margin: 0 0 4px;
          overflow-wrap: anywhere;
        }

        .postHeader p {
          margin: 0;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
        }

        .postText {
          color: #e5e7eb;
          font-size: 18px;
          line-height: 1.55;
          margin: 0 0 16px;
          white-space: pre-wrap;
        }

        .postImage {
          width: 100%;
          max-height: 520px;
          object-fit: cover;
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.12);
          margin-bottom: 14px;
        }

        .postStats {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 14px 0;
        }

        .postStats span {
          color: #a1a1aa;
          font-weight: 900;
        }

        .postActions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          border-top: 1px solid rgba(255,255,255,0.1);
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding: 12px 0;
        }

        .postActions button {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .commentsBox {
          margin-top: 16px;
          display: grid;
          gap: 12px;
        }

        .commentInput {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
        }

        .commentInput input {
          margin: 0;
        }

        .comment {
          padding: 13px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .comment strong {
          color: #22c55e;
          overflow-wrap: anywhere;
        }

        .comment p {
          color: #e5e7eb;
          margin: 6px 0;
        }

        .comment small,
        .noComments {
          color: #a1a1aa;
        }

        .empty {
          min-height: 280px;
          border-radius: 28px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 28px;
        }

        .emptyIcon {
          width: 82px;
          height: 82px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          margin-bottom: 18px;
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 28px;
        }

        .empty p {
          color: #a1a1aa;
          margin: 0;
        }

        @media (max-width: 960px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .sidePanel {
            position: static;
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 26px;
          }

          h1 {
            font-size: 44px;
          }

          .filters,
          .postActions,
          .commentInput {
            grid-template-columns: 1fr;
          }

          .composer,
          .postCard {
            padding: 20px;
            border-radius: 26px;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
  );
        }
