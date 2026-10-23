"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { request, type Room } from "../lib/chat-api";
import { useSession } from "./session-gate";

type RoomsPageProps = {
  home?: boolean;
};

export default function RoomsPage({ home = false }: RoomsPageProps) {
  const { session } = useSession();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [sort, setSort] = useState("newest");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    request<Room[]>("/rooms", session.token)
      .then(setRooms)
      .catch((loadError) => setError(loadError.message));
  }, [session.token]);

  const sortedRooms = useMemo(
    () =>
      [...rooms].sort((a, b) => {
        if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
        if (sort === "az") return a.name.localeCompare(b.name);
        if (sort === "za") return b.name.localeCompare(a.name);
        return b.created_at.localeCompare(a.created_at);
      }),
    [rooms, sort],
  );

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setBusy(true);
    setError("");
    try {
      const room = await request<Room>("/rooms", session.token, {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setRooms((current) => [room, ...current]);
      setName("");
      setCreateOpen(false);
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteRoom(room: Room) {
    try {
      await request(`/rooms/${room.id}`, session.token, { method: "DELETE" });
      setRooms((current) => current.filter((item) => item.id !== room.id));
    } catch (deleteError) {
      setError((deleteError as Error).message);
    }
  }

  return (
    <div
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
        <span className="eyebrow">LITTLE TALK COMMUNITY</span>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            margin: "9px 0 6px",
          }}
        >
          <h1 style={{ margin: 0, color: "#f2f2e9", fontSize: 30, fontWeight: 550 }}>
            {home ? "Explore rooms" : "Chat rooms"}
          </h1>
          <label style={{ color: "#aab29d", fontSize: 12 }}>
            Sort rooms{" "}
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="az">A - Z</option>
              <option value="za">Z - A</option>
            </select>
          </label>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setError("");
              setCreateOpen(true);
            }}
          >
            + Create room
          </button>
        </div>
        <p style={{ color: "#969d8e", fontSize: 12 }}>
          Pick a space and join the conversation.
        </p>
        {error && !createOpen && (
          <p role="alert" className="notice error-notice">
            {error}
          </p>
        )}
      </div>

      {createOpen && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setCreateOpen(false);
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
            aria-labelledby="create-room-title"
            onSubmit={createRoom}
            style={{
              width: "min(100%, 420px)",
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
              <h2 id="create-room-title" style={{ margin: 0, fontSize: 20 }}>
                Create a room
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setCreateOpen(false)}
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
              htmlFor="new-room-name"
              style={{
                display: "block",
                marginBottom: 8,
                color: "#aab29d",
                fontSize: 12,
              }}
            >
              Room name
            </label>
            <input
              id="new-room-name"
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Give your room a name"
              maxLength={48}
              style={{
                width: "100%",
                height: 44,
                padding: "0 12px",
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
                onClick={() => setCreateOpen(false)}
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
                disabled={busy || !name.trim()}
              >
                {busy ? "Creating…" : "Create room"}
              </button>
            </div>
          </form>
        </div>
      )}

      {sortedRooms.length ? (
        <div
          className="room-list"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: "100%",
            maxWidth: 760,
            margin: "0 auto",
          }}
        >
          {sortedRooms.map((room) => (
            <div
              key={room.id}
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
                position: "relative",
              }}
            >
              <Link
                href={`/rooms/${room.id}`}
                aria-label={`Open room ${room.name}`}
                style={{ position: "absolute", inset: 0, zIndex: 1 }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flex: 1,
                  minWidth: 0,
                  position: "relative",
                  zIndex: 2,
                  pointerEvents: "none",
                }}
              >
                <span className="room-directory-hash">#</span>
                <div style={{ flex: 1 }}>
                  <strong>{room.name}</strong>
                  <small style={{ display: "block", color: "#969d8e" }}>
                    Created by @{room.created_by}
                  </small>
                </div>
                {room.created_by === session.username && (
                  <button
                    type="button"
                    onClick={() => void deleteRoom(room)}
                    style={{ position: "relative", pointerEvents: "auto" }}
                  >
                    Delete
                  </button>
                )}
                <span className="room-open-button">Open room →</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="room-directory-empty">
          <h2>No rooms yet</h2>
          <p>Create a room to start the first conversation.</p>
        </div>
      )}
    </div>
  );
}
