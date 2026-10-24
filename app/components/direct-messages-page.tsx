"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import Avatar from "./avatar";
import { extractUsernames, request, type Conversation } from "../lib/chat-api";
import { useSession } from "./session-gate";

export default function DirectMessagesPage() {
  const { session } = useSession();
  const [users, setUsers] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [composeTo, setComposeTo] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");

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

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 3500);
    return () => window.clearTimeout(timer);
  }, [success]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!composeTo || !message.trim()) return;

    setBusy(true);
    setError("");
    try {
      await request(`/dm/${encodeURIComponent(composeTo)}`, session.token, {
        method: "POST",
        body: JSON.stringify({ body: message.trim() }),
      });
      setComposeTo(null);
      setMessage("");
      setSuccess("Message sent successfully.");
    } catch (sendError) {
      setError((sendError as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
              onClick={() => {
                setError("");
                setSuccess("");
                setMessage("");
                setComposeTo(person);
              }}
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
            </button>
          ))}
        </div>
      ) : (
        <div className="room-directory-empty">
          <h2>{query ? "No matching usernames" : "No usernames found"}</h2>
        </div>
      )}

      {success &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              top: 24,
              right: 24,
              zIndex: 200,
              padding: "14px 20px",
              border: "1px solid #52683b",
              borderRadius: 8,
              background: "#28321f",
              color: "#d4f3a6",
              boxShadow: "0 12px 36px #0008",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {success}
          </div>,
          document.body,
        )}

      {composeTo &&
        createPortal(
          <div
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !busy) {
                setComposeTo(null);
              }
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              display: "grid",
              placeItems: "center",
              padding: 20,
              background: "rgba(0, 0, 0, 0.68)",
            }}
          >
            <form
              role="dialog"
              aria-modal="true"
              aria-labelledby="direct-message-title"
              onSubmit={sendMessage}
              style={{
                width: "min(100%, 440px)",
                padding: 24,
                border: "1px solid #3a4135",
                borderRadius: 8,
                background: "#191d18",
                color: "#eef0e5",
                boxShadow: "0 24px 70px #0009",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 18,
                }}
              >
                <h2 id="direct-message-title" style={{ margin: 0, fontSize: 20 }}>
                  Message @{composeTo}
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setComposeTo(null)}
                  disabled={busy}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#aab29d",
                    fontSize: 22,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
              <label
                htmlFor="directory-message"
                style={{
                  display: "block",
                  marginBottom: 8,
                  color: "#aab29d",
                  fontSize: 12,
                }}
              >
                Your message
              </label>
              <textarea
                id="directory-message"
                autoFocus
                required
                rows={4}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={`Write a message to @${composeTo}…`}
                style={{
                  width: "100%",
                  minHeight: 100,
                  padding: 12,
                  resize: "vertical",
                  border: "1px solid #3a4135",
                  borderRadius: 4,
                  background: "#111410",
                  color: "#eef0e5",
                  fontSize: 13,
                }}
              />
              {error && (
                <p role="alert" className="notice error-notice">
                  {error}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 20,
                }}
              >
                <button
                  type="button"
                  onClick={() => setComposeTo(null)}
                  disabled={busy}
                  style={{
                    minHeight: 40,
                    padding: "0 14px",
                    border: "1px solid #3a4135",
                    borderRadius: 4,
                    background: "transparent",
                    color: "#d0d5c8",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={busy || !message.trim()}
                >
                  {busy ? "Sending…" : "Send message"}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </main>
  );
}
