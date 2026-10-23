"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import Avatar from "./avatar";
import { useSession } from "./session-gate";

type PageFrameProps = {
  children: ReactNode;
};

export default function PageFrame({ children }: PageFrameProps) {
  const { session, signOut } = useSession();
  const router = useRouter();

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
            <Link className="nav-row nav-main" href="/rooms">
              <span className="hash">#</span>
              <span>All rooms</span>
            </Link>
          </div>
        </nav>

        <nav className="side-section dm-section">
          <div className="section-heading">
            <Link className="chat-room-home-link" href="/conversations">
              MESSAGES
            </Link>
          </div>
          <div className="nav-list">
            <Link className="nav-row nav-main" href="/direct-messages">
              <span className="dm-name">All usernames</span>
            </Link>
            <Link className="nav-row nav-main" href="/conversations">
              <span className="dm-name">Conversations</span>
            </Link>
          </div>
        </nav>

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
