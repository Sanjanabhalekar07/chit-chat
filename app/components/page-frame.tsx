"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import Avatar from "./avatar";
import { useSession } from "./session-gate";
import {
  extractUsernames,
  request,
  type Conversation,
  type Room,
} from "../lib/chat-api";

type PageFrameProps = {
  children: ReactNode;
};

export default function PageFrame({ children }: PageFrameProps) {
  const { session, signOut } = useSession();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    let active = true;
    const loadSidebarData = async () => {
      const [roomResult, conversationResult] = await Promise.allSettled([
        request<Room[]>("/rooms", session.token),
        request<Conversation[]>("/dm", session.token),
      ]);

      if (!active) return;

      if (roomResult.status === "fulfilled") setRooms(roomResult.value);
      if (conversationResult.status === "fulfilled") {
        setConversations(conversationResult.value);
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

  function handleSignOut() {
    signOut();
    router.push("/");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar sidebar-visible">
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
              </Link>
            ))}
            {!rooms.length && <div className="empty-sidebar">No rooms yet.</div>}
          </div>
        </nav>

        <div className="side-section dm-section">
          <div className="nav-list">
            <div className="section-heading">
              <Link className="chat-room-home-link" href="/direct-messages">
                USERNAMES
              </Link>
            </div>
            {usernames.map((name) => (
              <div className="nav-row" key={name}>
                <Avatar name={name} small />
                <span className="dm-name">{name}</span>
              </div>
            ))}
            {!usernames.length && <div className="empty-sidebar">No users found.</div>}

            <div className="section-heading" style={{ marginTop: 18 }}>
              <Link className="chat-room-home-link" href="/conversations">
                CONVERSATIONS
              </Link>
            </div>
            {conversations.map((conversation) => (
              <Link
                className="nav-row nav-main"
                href={`/conversations/${encodeURIComponent(conversation.username)}`}
                key={conversation.username}
              >
                <Avatar name={conversation.username} small />
                <span className="dm-name">{conversation.username}</span>
              </Link>
            ))}
            {!conversations.length && (
              <div className="empty-sidebar">No conversations yet.</div>
            )}
          </div>
        </div>

        <div className="side-spacer" />
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
