"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Avatar from "./avatar";
import { request, type Message, type Room } from "../lib/chat-api";
import { useSession } from "./session-gate";

type SingleChatPageProps = {
  roomId?: number;
  username?: string;
};

export default function SingleChatPage({ roomId, username }: SingleChatPageProps) {
  const { session } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState(username || "Chat");
  const [draft, setDraft] = useState("");
  const [composeTo, setComposeTo] = useState<string | null>(null);
  const [quickDraft, setQuickDraft] = useState("");
  const [directSuccess, setDirectSuccess] = useState("");
  const [openUserMenu, setOpenUserMenu] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const path = roomId
    ? `/rooms/${roomId}/messages`
    : `/dm/${encodeURIComponent(username || "")}`;

  useEffect(() => {
    let active = true;

    if (roomId) {
      request<Room[]>("/rooms", session.token)
        .then((rooms) => {
          const room = rooms.find((item) => item.id === roomId);
          if (active && room) setTitle(room.name);
        })
        .catch(() => undefined);
    }

    let cursor = "";
    const load = async () => {
      try {
        const suffix = cursor
          ? `?after=${encodeURIComponent(
              new Date(Math.max(0, Date.parse(cursor) - 2000)).toISOString(),
            )}`
          : "";
        const data = await request<Message[]>(`${path}${suffix}`, session.token);
        if (!active) return;

        setMessages((existing) => {
          const next = cursor
            ? [
                ...existing,
                ...data.filter((message) => !existing.some((item) => item.id === message.id)),
              ]
            : data;
          const unchanged =
            next.length === existing.length &&
            next.every((message, index) => message.id === existing[index]?.id);
          return unchanged ? existing : next;
        });

        if (data.length) {
          cursor = data.reduce(
            (latest, message) =>
              Date.parse(message.created_at) > Date.parse(latest)
                ? message.created_at
                : latest,
            cursor || data[0].created_at,
          );
        }
      } catch (loadError) {
        if (active) setError((loadError as Error).message);
      }
    };

    void load();
    const timer = window.setInterval(load, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [path, roomId, session.token]);

  useEffect(() => {
    if (!messages.length) return;
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (openUserMenu === null) return;

    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && !target.closest(".message-user-menu-wrap")) {
        setOpenUserMenu(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenUserMenu(null);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openUserMenu]);

  useEffect(() => {
    if (!directSuccess) return;
    const timer = window.setTimeout(() => setDirectSuccess(""), 3500);
    return () => window.clearTimeout(timer);
  }, [directSuccess]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;

    setBusy(true);
    setError("");
    try {
      const message = await request<Message>(path, session.token, {
        method: "POST",
        body: JSON.stringify({ body: draft.trim() }),
      });
      setMessages((existing) =>
        existing.some((item) => item.id === message.id)
          ? existing
          : [...existing, message],
      );
      setDraft("");
    } catch (sendError) {
      setError((sendError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function block(target = username) {
    if (!target) return;

    try {
      await request(`/blocks/${encodeURIComponent(target)}`, session.token, {
        method: "POST",
      });
      setOpenUserMenu(null);
      router.push("/conversations");
    } catch (blockError) {
      setError((blockError as Error).message);
    }
  }

  async function sendDirectMessage(event: FormEvent) {
    event.preventDefault();
    const recipient = composeTo;
    if (!recipient || !quickDraft.trim()) return;
    if (recipient.toLowerCase() === session.username.toLowerCase()) {
      setError("You can’t send a direct message to yourself.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await request<Message>(
        `/dm/${encodeURIComponent(recipient)}`,
        session.token,
        {
          method: "POST",
          body: JSON.stringify({ body: quickDraft.trim() }),
        },
      );
      setQuickDraft("");
      setComposeTo(null);
      setDirectSuccess("Message sent successfully.");
    } catch (sendError) {
      setError((sendError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function openMessagePopup(recipient: string) {
    setQuickDraft("");
    setDirectSuccess("");
    setError("");
    setComposeTo(recipient);
  }

  return (
    <>
      <div className="conversation-head">
        <div className="conversation-identity">
          {roomId ? <span className="room-icon">#</span> : <Avatar name={title} />}
          <div>
            <h1>{title}</h1>
            <p>{roomId ? "A space for good conversation" : "A little one-to-one corner"}</p>
          </div>
        </div>
        {username && (
          <button className="soft-action block-user-action" onClick={() => void block()}>
            Block User
          </button>
        )}
      </div>

      {directSuccess &&
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
            {directSuccess}
          </div>,
          document.body,
        )}
      {error && !composeTo && <p className="notice-bar">{error}</p>}

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
            zIndex: 50,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(0, 0, 0, 0.68)",
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-user-title"
            onSubmit={sendDirectMessage}
            style={{
              width: "min(100%, 460px)",
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
              <h2 id="message-user-title" style={{ margin: 0, fontSize: 20 }}>
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
            {error && (
              <p role="alert" className="notice error-notice">
                {error}
              </p>
            )}
            <label
              htmlFor="direct-message-body"
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
              id="direct-message-body"
              autoFocus
              required
              rows={4}
              value={quickDraft}
              onChange={(event) => {
                setQuickDraft(event.target.value);
              }}
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
            {composeTo.toLowerCase() === session.username.toLowerCase() && (
              <p style={{ margin: "8px 0 0", color: "#969d8e", fontSize: 11 }}>
                This is your account, so a direct message can’t be sent to it.
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
                disabled={
                  busy ||
                  !quickDraft.trim() ||
                  composeTo.toLowerCase() === session.username.toLowerCase()
                }
              >
                {busy ? "Sending…" : `Send to @${composeTo}`}
              </button>
            </div>
          </form>
        </div>
        ,
        document.body,
      )}

      <div className="messages-scroll">
        {messages.length === 0 ? (
          <div className="empty-conversation">
            <h2>{roomId ? `A fresh start in ${title}` : `Say hello to ${title}`}</h2>
            <p>Send the first message and see where it goes.</p>
          </div>
        ) : (
          <div className="message-list">
            {messages.map((message) => (
              <article
                className={`message ${message.sender === session.username ? "own-message" : ""}`}
                key={message.id}
              >
                <Avatar name={message.sender} small />
                <div className="message-content">
                  <div className="message-byline">
                    {message.sender === session.username ? (
                      <strong>You</strong>
                    ) : (
                      (
                        <span className="message-user-menu-wrap">
                          <button
                            type="button"
                            className="message-user-link"
                            aria-label={`Actions for ${message.sender}`}
                            aria-haspopup="menu"
                            aria-expanded={openUserMenu === message.id}
                            title={`Actions for @${message.sender}`}
                            onClick={() => setOpenUserMenu((current) => current === message.id ? null : message.id)}
                          >
                            {message.sender}
                          </button>
                          {openUserMenu === message.id && (
                            <div className="message-user-menu" role="menu" aria-label={`Actions for ${message.sender}`}>
                              <button type="button" role="menuitem" onClick={() => {
                                setOpenUserMenu(null);
                                openMessagePopup(message.sender);
                              }}>
                                Direct message
                              </button>
                              <button type="button" role="menuitem" onClick={() => void block(message.sender)}>
                                Block User
                              </button>
                            </div>
                          )}
                        </span>
                      )
                    )}
                    <time>
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p>{message.body}</p>
                </div>
              </article>
            ))}
            <div ref={bottom} />
          </div>
        )}
      </div>

      <div className="composer-wrap">
        <form className="message-composer" onSubmit={send}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={`Write a message to ${roomId ? `#${title}` : title}…`}
            rows={1}
          />
          <div className="composer-tools">
            <span>Be kind, keep it human</span>
            <button className="send-button" disabled={busy || !draft.trim()}>
              ↑
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
