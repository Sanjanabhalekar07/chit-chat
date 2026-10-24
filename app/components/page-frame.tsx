"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import Avatar from "./avatar";
import { useSession } from "./session-gate";
import {
  extractUsernames,
  request,
  type Conversation,
  type Message,
  type Room,
} from "../lib/chat-api";

type PageFrameProps = {
  children: ReactNode;
};

export default function PageFrame({ children }: PageFrameProps) {
  const { session, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [updatingBlockedUser, setUpdatingBlockedUser] = useState<string | null>(null);
  const [blockedUsersError, setBlockedUsersError] = useState("");
  const [sidebarNotice, setSidebarNotice] = useState("");
  const [readMarkers, setReadMarkers] = useState<Record<string, string>>({});
  const [readMarkersLoaded, setReadMarkersLoaded] = useState(false);
  const [unreadMessageCounts, setUnreadMessageCounts] = useState<Record<string, number>>({});
  const [roomReadMarkers, setRoomReadMarkers] = useState<Record<string, string>>({});
  const [roomReadMarkersLoaded, setRoomReadMarkersLoaded] = useState(false);
  const [roomUnreadCounts, setRoomUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("little-talk-dm-read-markers");
      if (saved) setReadMarkers(JSON.parse(saved) as Record<string, string>);
    } catch {
      setReadMarkers({});
    }
    setReadMarkersLoaded(true);

    try {
      const saved = window.localStorage.getItem("little-talk-room-read-markers");
      if (saved) setRoomReadMarkers(JSON.parse(saved) as Record<string, string>);
    } catch {
      setRoomReadMarkers({});
    }
    setRoomReadMarkersLoaded(true);
  }, []);

  useEffect(() => {
    let active = true;
    const loadSidebarData = async () => {
      const [roomResult, conversationResult, blockedResult] = await Promise.allSettled([
        request<Room[]>("/rooms", session.token),
        request<Conversation[]>("/dm", session.token),
        request<unknown>("/blocks", session.token),
      ]);

      if (!active) return;

      if (roomResult.status === "fulfilled") setRooms(roomResult.value);
      if (conversationResult.status === "fulfilled") {
        setConversations(conversationResult.value);
      }
      if (blockedResult.status === "fulfilled") {
        setBlockedUsers(
          [...new Set(extractUsernames(blockedResult.value))]
            .filter((name) => name.toLowerCase() !== session.username.toLowerCase())
            .sort((a, b) => a.localeCompare(b)),
        );
        setBlockedUsersError("");
      } else {
        setBlockedUsersError("Blocked users could not be loaded.");
      }

      try {
        let directory: unknown;
        try {
          directory = await request<unknown>("/users", session.token);
        } catch {
          directory = await request<unknown>("/users?search=", session.token);
        }

        if (active) {
          const conversationNames =
            conversationResult.status === "fulfilled"
              ? conversationResult.value.map((conversation) => conversation.username)
              : [];
          setUsernames(
            [...new Set([...extractUsernames(directory), ...conversationNames])]
              .filter((name) => name.toLowerCase() !== session.username.toLowerCase())
              .sort((a, b) => a.localeCompare(b)),
          );
        }
      } catch {
        if (active && conversationResult.status === "fulfilled") {
          setUsernames(
            conversationResult.value
              .map((conversation) => conversation.username)
              .filter((name) => name.toLowerCase() !== session.username.toLowerCase())
              .sort((a, b) => a.localeCompare(b)),
          );
        }
      }
    };

    void loadSidebarData();
    const timer = window.setInterval(loadSidebarData, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [session.token]);

  useEffect(() => {
    if (!readMarkersLoaded || !pathname.startsWith("/conversations/")) return;

    const encodedUsername = pathname.slice("/conversations/".length);
    let activeUsername: string;
    try {
      activeUsername = decodeURIComponent(encodedUsername);
    } catch {
      return;
    }

    const conversation = conversations.find(
      (item) => item.username.toLowerCase() === activeUsername.toLowerCase(),
    );
    const latest = conversation?.last_message;
    const conversationUsername = conversation?.username;
    if (!conversationUsername || !latest) return;

    setReadMarkers((current) => {
      if ((current[conversationUsername] || "") >= latest.created_at) return current;
      const next = { ...current, [conversationUsername]: latest.created_at };
      window.localStorage.setItem("little-talk-dm-read-markers", JSON.stringify(next));
      return next;
    });
  }, [conversations, pathname, readMarkersLoaded, session.username]);

  useEffect(() => {
    if (!readMarkersLoaded || !conversations.length) return;

    setReadMarkers((current) => {
      const next = { ...current };
      let changed = false;
      conversations.forEach((conversation) => {
        if (
          !Object.prototype.hasOwnProperty.call(next, conversation.username) &&
          conversation.last_message
        ) {
          next[conversation.username] = conversation.last_message.created_at;
          changed = true;
        }
      });
      if (!changed) return current;
      window.localStorage.setItem("little-talk-dm-read-markers", JSON.stringify(next));
      return next;
    });
  }, [conversations, readMarkersLoaded]);

  useEffect(() => {
    const markersReady = conversations.every(
      (conversation) =>
        !conversation.last_message ||
        Object.prototype.hasOwnProperty.call(readMarkers, conversation.username),
    );
    if (!readMarkersLoaded || !conversations.length || !markersReady) {
      setUnreadMessageCounts({});
      return;
    }

    let active = true;
    const loadUnreadCounts = async () => {
      const results = await Promise.allSettled(
        conversations.map(async (conversation) => {
          const messages = await request<Message[]>(
            `/dm/${encodeURIComponent(conversation.username)}`,
            session.token,
          );
          const lastReadAt = readMarkers[conversation.username] || "";
          const unreadCount = messages.filter(
            (message) =>
              message.sender.toLowerCase() !== session.username.toLowerCase() &&
              message.created_at > lastReadAt,
          ).length;
          return [conversation.username, unreadCount] as const;
        }),
      );

      if (!active) return;
      const next: Record<string, number> = {};
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const [conversationUsername, count] = result.value;
          if (count > 0) next[conversationUsername] = count;
        }
      });
      setUnreadMessageCounts(next);
    };

    void loadUnreadCounts();
    return () => {
      active = false;
    };
  }, [conversations, readMarkers, readMarkersLoaded, session.token, session.username]);

  useEffect(() => {
    if (!roomReadMarkersLoaded || !pathname.startsWith("/rooms/")) return;
    const roomId = Number(pathname.slice("/rooms/".length).split("/")[0]);
    if (!Number.isInteger(roomId) || roomId <= 0) return;

    let active = true;
    request<Message[]>(`/rooms/${roomId}/messages`, session.token)
      .then((messages) => {
        if (!active || !messages.length) return;
        const latest = messages.reduce((timestamp, message) =>
          message.created_at > timestamp ? message.created_at : timestamp,
        "");
        const key = String(roomId);
        setRoomReadMarkers((current) => {
          if ((current[key] || "") >= latest) return current;
          const next = { ...current, [key]: latest };
          window.localStorage.setItem("little-talk-room-read-markers", JSON.stringify(next));
          return next;
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [pathname, roomReadMarkersLoaded, session.token]);

  useEffect(() => {
    if (!roomReadMarkersLoaded || !rooms.length) {
      setRoomUnreadCounts({});
      return;
    }

    let active = true;
    const loadRoomUnreadCounts = async () => {
      const results = await Promise.allSettled(
        rooms.map(async (room) => {
          const key = String(room.id);
          const lastReadAt = roomReadMarkers[key] || "";
          const isFirstCheck = !Object.prototype.hasOwnProperty.call(roomReadMarkers, key);
          const after = !isFirstCheck && lastReadAt
            ? `?after=${encodeURIComponent(
                new Date(Math.max(0, Date.parse(lastReadAt) - 2000)).toISOString(),
              )}`
            : "";
          const messages = await request<Message[]>(
            `/rooms/${room.id}/messages${after}`,
            session.token,
          );
          if (isFirstCheck) {
            const latest = messages.reduce(
              (timestamp, message) =>
                message.created_at > timestamp ? message.created_at : timestamp,
              "",
            );
            return [key, 0, latest, true] as const;
          }
          const count = messages.filter(
            (message) =>
              message.sender.toLowerCase() !== session.username.toLowerCase() &&
              message.created_at > lastReadAt,
          ).length;
          return [key, count, lastReadAt, false] as const;
        }),
      );

      if (!active) return;
      const next: Record<string, number> = {};
      const baselines: Record<string, string> = {};
      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        const [key, count, latest, isFirstCheck] = result.value;
        if (count > 0) next[key] = count;
        if (isFirstCheck) baselines[key] = latest;
      });
      setRoomUnreadCounts(next);
      if (Object.keys(baselines).length) {
        setRoomReadMarkers((current) => {
          const updated = { ...current, ...baselines };
          window.localStorage.setItem("little-talk-room-read-markers", JSON.stringify(updated));
          return updated;
        });
      }
    };

    void loadRoomUnreadCounts();
    return () => {
      active = false;
    };
  }, [rooms, roomReadMarkers, roomReadMarkersLoaded, session.token, session.username]);

  const unreadMessageTotal = Object.values(unreadMessageCounts).reduce(
    (total, count) => total + count,
    0,
  );

  function handleSignOut() {
    signOut();
    router.push("/");
  }

  async function unblockUser(username: string) {
    setUpdatingBlockedUser(username);
    setSidebarNotice("");
    try {
      await request(`/blocks/${encodeURIComponent(username)}`, session.token, {
        method: "DELETE",
      });
      setBlockedUsers((current) =>
        current.filter((name) => name.toLowerCase() !== username.toLowerCase()),
      );
      setSidebarNotice(`@${username} unblocked.`);
    } catch (unblockError) {
      setSidebarNotice((unblockError as Error).message || "Could not unblock user.");
    } finally {
      setUpdatingBlockedUser(null);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="side-brand-wrap">
          <div className="side-brand">
            <Link className="brand-home" href="/">
              <span className="brand-mark">✳</span>
              <span>little talk</span>
            </Link>
          </div>
        </div>

        <div className="profile-card">
          <Avatar name={session.username} />
          <span className="profile-meta">
            <strong>@{session.username}</strong>
            <small>
              <i /> Here for a chat
            </small>
          </span>
        </div>

        <nav className="side-section">
          <div className="section-heading">
            <Link className="chat-room-home-link" href="/rooms">
              CHAT ROOM
            </Link>
          </div>
          <div className="nav-list">
            {rooms.map((room) => (
              <Link
                className="nav-row nav-main"
                href={`/rooms/${room.id}`}
                key={room.id}
              >
                <span className="hash">#</span>
                <span>{room.name}</span>
                {(roomUnreadCounts[String(room.id)] || 0) > 0 && (
                  <span
                    className="dm-unread-count"
                    aria-label={`${roomUnreadCounts[String(room.id)]} new messages`}
                  >
                    {roomUnreadCounts[String(room.id)] > 9
                      ? "9+"
                      : roomUnreadCounts[String(room.id)]}
                  </span>
                )}
              </Link>
            ))}
            {!rooms.length && <div className="empty-sidebar">No rooms yet.</div>}
          </div>
        </nav>

        <div className="side-section dm-section">
          <div className="nav-list">
            <div className="section-heading" style={{ marginTop: 10 }}>
              <Link className="chat-room-home-link" href="/conversations">
                DIRECT MESSAGES
              </Link>
              {unreadMessageTotal > 0 && (
                <span className="dm-unread-count" aria-label={`${unreadMessageTotal} unread messages`}>
                  {unreadMessageTotal}
                </span>
              )}
            </div>
            {conversations.map((conversation) => (
              <Link
                className="nav-row nav-main"
                href={`/conversations/${encodeURIComponent(conversation.username)}`}
                key={conversation.username}
              >
                <Avatar name={conversation.username} small />
                <span className="dm-name">{conversation.username}</span>
                {(unreadMessageCounts[conversation.username] || 0) > 0 && (
                  <span className="dm-unread-count" aria-label={`${unreadMessageCounts[conversation.username]} unread messages`}>
                    {unreadMessageCounts[conversation.username]}
                  </span>
                )}
              </Link>
            ))}
            {!conversations.length && (
              <div className="empty-sidebar">No conversations yet.</div>
            )}

            <div className="blocked-users-box">
              <div className="section-heading">
                <span>BLOCKED USERS</span>
              </div>
              {blockedUsersError ? (
                <p className="empty-sidebar">{blockedUsersError}</p>
              ) : blockedUsers.length ? (
                blockedUsers.map((name) => (
                  <div className="blocked-sidebar-row" key={name}>
                    <Avatar name={name} small />
                    <span className="dm-name">{name}</span>
                    <button
                      type="button"
                      disabled={updatingBlockedUser !== null}
                      onClick={() => void unblockUser(name)}
                    >
                      {updatingBlockedUser === name ? "…" : "Unblock"}
                    </button>
                  </div>
                ))
              ) : (
                <p className="empty-sidebar">No blocked users.</p>
              )}
            </div>
          </div>
        </div>

        <div className="side-spacer" />
        {sidebarNotice && (
          <p role="status" className="sidebar-notice">
            {sidebarNotice}
          </p>
        )}
        <button type="button" className="sidebar-signout" onClick={handleSignOut}>
          <span className="sidebar-signout-label">Sign out</span>
        </button>
        <div className="side-bottom">
          <span className="online-dot" /> A little room to connect <span>✳</span>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="topbar">
          <Link className="mobile-brand" href="/rooms">
            ‹ Chat Room
          </Link>
          <div className="crumb">
            <Link className="crumb-home-link" href="/">
              HOME
            </Link>
            <b>/</b>
            <strong>@{session.username}</strong>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
