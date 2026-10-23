"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "./avatar";
import { extractUsernames, request, type Conversation } from "../lib/chat-api";
import { useSession } from "./session-gate";

export default function DirectMessagesPage() {
  const { session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      try {
        let result: unknown;
        try {
          result = await request("/users", session.token);
        } catch {
          result = await request("/users?search=", session.token);
        }

        const usernames = extractUsernames(result);
        let conversations: Conversation[] = [];
        try {
          conversations = await request("/dm", session.token);
        } catch {
          // Keep the user directory available if conversation data is unavailable.
        }

        if (active) {
          setUsers(
            [...new Set([...usernames, ...conversations.map((item) => item.username)])]
              .filter((name) => name.toLowerCase() !== session.username.toLowerCase())
              .sort((a, b) => a.localeCompare(b)),
          );
        }
      } catch (loadError) {
        if (active) setError((loadError as Error).message);
      }
    };

    void loadUsers();
    const timer = window.setInterval(loadUsers, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [session]);

  const visibleUsers = users.filter((name) =>
    name.toLowerCase().includes(query.toLowerCase()),
  );

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
        <span className="eyebrow">DIRECT MESSAGES</span>
        <h1>All usernames</h1>
        <p>{users.length} usernames available</p>
        <input
          aria-label="Search usernames"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search usernames"
        />
        {error && <p role="alert">{error}</p>}
      </div>

      {visibleUsers.length ? (
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
          {visibleUsers.map((person) => (
            <button
              type="button"
              key={person}
              onClick={() => router.push(`/conversations/${encodeURIComponent(person)}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "100%",
                minHeight: 64,
                padding: "12px 16px",
                border: "1px solid #30362c",
                borderRadius: 5,
                background: "#191d18",
                color: "#eef0e5",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <Avatar name={person} />
              <strong style={{ flex: 1 }}>@{person}</strong>
              <span style={{ color: "#c5f36a" }}>Message →</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="room-directory-empty">
          <h2>{query ? "No matching usernames" : "No usernames found"}</h2>
        </div>
      )}
    </main>
  );
}
