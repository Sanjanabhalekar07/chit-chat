"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "./avatar";
import { request, timeLabel, type Conversation } from "../lib/chat-api";
import { useSession } from "./session-gate";

export default function ConversationsPage() {
  const { session } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadConversations = () => {
      request<Conversation[]>("/dm", session.token)
        .then((data) => {
          if (active) setConversations(data.slice(0, 100));
        })
        .catch((loadError) => {
          if (active) setError(loadError.message);
        });
    };

    loadConversations();
    const timer = window.setInterval(loadConversations, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [session.token]);

  return (
    <main
      className="room-directory"
      style={{
        display: "block",
        flex: 1,
        overflowY: "auto",
        padding: "48px clamp(20px, 7vw, 88px)",
        background: "#111410",
      }}
    >
      <div
        className="room-directory-heading"
        style={{ maxWidth: 760, margin: "0 auto 24px" }}
      >
        <span className="eyebrow">YOUR INBOX</span>
        <h1>Conversations</h1>
        <p>Your latest conversations, up to {conversations.length}.</p>
        {error && <p role="alert">{error}</p>}
      </div>

      {conversations.length ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: "100%",
            maxWidth: 760,
            margin: "0 auto",
          }}
        >
          {conversations.map((conversation) => (
            <button
              type="button"
              key={conversation.username}
              onClick={() =>
                router.push(`/conversations/${encodeURIComponent(conversation.username)}`)
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "100%",
                minHeight: 72,
                padding: "12px 16px",
                border: "1px solid #30362c",
                borderRadius: 5,
                background: "#191d18",
                color: "#eef0e5",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <Avatar name={conversation.username} />
              <span
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <strong>@{conversation.username}</strong>
                <small style={{ color: "#969d8e" }}>
                  {conversation.last_message?.body || "Start a conversation"}
                </small>
              </span>
              <small>{timeLabel(conversation.last_message?.created_at)}</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="room-directory-empty">
          <h2>No messages yet</h2>
          <p>Choose a username to start a conversation.</p>
        </div>
      )}
    </main>
  );
}
