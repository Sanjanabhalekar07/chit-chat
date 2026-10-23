"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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

        if (!cursor) {
          setMessages(data);
        } else {
          setMessages((existing) => [
            ...existing,
            ...data.filter((message) => !existing.some((item) => item.id === message.id)),
          ]);
        }

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
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  async function block() {
    if (!username) return;

    try {
      await request(`/blocks/${encodeURIComponent(username)}`, session.token, {
        method: "POST",
      });
      router.push("/conversations");
    } catch (blockError) {
      setError((blockError as Error).message);
    }
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
          <button className="soft-action" onClick={() => void block()}>
            Block user
          </button>
        )}
      </div>

      {error && <p className="notice-bar">{error}</p>}

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
                    <strong>{message.sender === session.username ? "You" : message.sender}</strong>
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
