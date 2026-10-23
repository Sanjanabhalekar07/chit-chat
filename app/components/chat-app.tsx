"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Avatar from "./avatar";
import ChatSidebar, { type Blocked, type Room, type View } from "./chat-sidebar";
import RightRail from "./right-rail";
import WelcomeScreen from "./welcome-screen";

const API = "https://chatapp.adnecto.in/api";
type Message = { id: number; sender: string; room_id: number | null; recipient: string | null; body: string; created_at: string };
type Conversation = { username: string; last_message: { body: string; sender: string; created_at: string } | null };
type Session = { username: string; token: string };
type IncomingPopup = { username: string; body: string };

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `Request failed (${response.status})`);
  return result.data as T;
}

function timeLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function roomCreatedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function extractUsernames(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((user) => {
      if (typeof user === "string") return [user];
      if (!user || typeof user !== "object") return [];
      const record = user as Record<string, unknown>;
      const name = record.username ?? record.user_name ?? record.handle ?? record.name;
      return typeof name === "string" ? [name] : [];
    });
  }
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  // APIs may wrap the user array in one or more `data` / `results` objects.
  for (const key of ["users", "results", "data", "items"]) {
    const names = extractUsernames(record[key]);
    if (names.length) return names;
  }
  return [];
}

export default function ChatApp() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomSort, setRoomSort] = useState<"newest" | "oldest" | "az" | "za">("newest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [alphaMenuOpen, setAlphaMenuOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userDirectory, setUserDirectory] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [view, setView] = useState<View | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [dmTarget, setDmTarget] = useState("");
  const [quickMessage, setQuickMessage] = useState("");
  const [userSuggestions, setUserSuggestions] = useState<string[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [composer, setComposer] = useState<"room" | "dm" | null>(null);
  const [section, setSection] = useState<"rooms" | "messages">("rooms");
  const [inboxTab, setInboxTab] = useState<"conversations" | "users">("conversations");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [unreadPeople, setUnreadPeople] = useState<Set<string>>(() => new Set());
  const [incomingPopup, setIncomingPopup] = useState<IncomingPopup | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<string | null>(null);
  const currentView = useRef<View | null>(null);
  const lastDmMessages = useRef<Map<string, string> | null>(null);
  const me = session?.username;

  useEffect(() => {
    const stored = localStorage.getItem("little-talk-session");
    if (stored) {
      try { setSession(JSON.parse(stored)); } catch { localStorage.removeItem("little-talk-session"); }
    }
    setReady(true);
  }, []);

  const refreshLists = useCallback(async (token: string) => {
    const [roomData, dmData, blockData] = await Promise.all([
      request<Room[]>("/rooms", token), request<Conversation[]>("/dm", token), request<Blocked[]>("/blocks", token),
    ]);
    setRooms(roomData); setConversations(dmData); setBlocked(blockData);
    return { roomData, dmData };
  }, []);

  useEffect(() => {
    if (!session) return;
    request("/me", session.token).then(() => refreshLists(session.token))
      .catch((error: Error) => { setNotice(error.message); if (error.message.includes("expired")) signOut(); });
  }, [session, refreshLists]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    let lastUserSync = 0;
    lastDmMessages.current = null;
    const syncLists = async () => {
      try {
        const latest = await Promise.all([
          request<Room[]>("/rooms", session.token),
          request<Conversation[]>("/dm", session.token),
          request<Blocked[]>("/blocks", session.token),
        ]);
        if (active) {
          setRooms(latest[0]);
          setConversations(latest[1]);
          setBlocked(latest[2]);
          const previousMessages = lastDmMessages.current;
          const currentMessages = new Map(latest[1].filter((item) => item.last_message).map((item) => [item.username, `${item.last_message!.created_at}|${item.last_message!.sender}|${item.last_message!.body}`]));
          if (previousMessages) {
            const incomingMessages = latest[1].filter((item) => {
              const lastMessage = item.last_message;
              return !!lastMessage && lastMessage.sender !== session.username && previousMessages.get(item.username) !== currentMessages.get(item.username);
            });
            incomingMessages.forEach((item) => {
              if (currentView.current?.type !== "dm" || currentView.current.username.toLowerCase() !== item.username.toLowerCase()) {
                setUnreadPeople((people) => new Set(people).add(item.username.toLowerCase()));
              }
            });
            const incoming = incomingMessages.at(-1);
            if (incoming?.last_message) {
              const body = incoming.last_message.body;
              setIncomingPopup({ username: incoming.username, body });
              window.setTimeout(() => setIncomingPopup((current) => current?.username === incoming.username && current.body === body ? null : current), 7000);
              if ("Notification" in window && Notification.permission === "granted") {
                const notification = new Notification(`New message from @${incoming.username}`, { body });
                notification.onclick = () => { window.focus(); setView({ type: "dm", username: incoming.username }); setSection("messages"); notification.close(); };
              }
            }
          }
          lastDmMessages.current = currentMessages;
        }
      } catch { /* Keep the current lists if a background refresh fails. */ }
      if (Date.now() - lastUserSync >= 15000) {
        lastUserSync = Date.now();
        try {
          let allUsers: unknown;
          try { allUsers = await request<unknown>("/users", session.token); }
          catch { allUsers = await request<unknown>("/users?search=", session.token); }
          if (active) setUserDirectory(extractUsernames(allUsers));
        } catch { /* User suggestions can still use contacts and room participants. */ }
      }
    };
    const interval = window.setInterval(syncLists, 5000);
    void syncLists();
    document.addEventListener("visibilitychange", syncLists);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", syncLists);
    };
  }, [session]);

  useEffect(() => {
    if (!session || composer !== "dm") {
      setUserSuggestions([]);
      setSearchingUsers(false);
      return;
    }
    const query = dmTarget.trim();
    const knownNames = [...userDirectory, ...conversations.map((item) => item.username), ...rooms.map((item) => item.created_by), ...messages.map((item) => item.sender)];
    const blockedNames = new Set(blocked.map((item) => item.username.toLowerCase()));
    const matches = (names: string[]) => [...new Set(names)].filter((name) => name && name.toLowerCase() !== me?.toLowerCase() && (!query || name.toLowerCase().startsWith(query.toLowerCase())) && !blockedNames.has(name.toLowerCase()));
    if (!query) {
      setUserSuggestions(matches(knownNames));
      setSearchingUsers(false);
      return;
    }
    let active = true;
    let loadingIndicatorTimer: number | undefined;
    setSearchingUsers(false);
    const timer = window.setTimeout(async () => {
      loadingIndicatorTimer = window.setTimeout(() => {
        if (active) setSearchingUsers(true);
      }, 600);
      try {
        const result = await request<unknown>(`/users?search=${encodeURIComponent(query)}`, session.token);
        const names = extractUsernames(result);
        if (active) setUserSuggestions(matches([...names, ...knownNames]).slice(0, 12));
      } catch {
        if (active) setUserSuggestions(matches(knownNames));
      } finally {
        if (loadingIndicatorTimer !== undefined) window.clearTimeout(loadingIndicatorTimer);
        if (active) setSearchingUsers(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); if (loadingIndicatorTimer !== undefined) window.clearTimeout(loadingIndicatorTimer); };
  }, [session, composer, dmTarget, conversations, rooms, messages, blocked, userDirectory, me]);

  useEffect(() => { currentView.current = view; }, [view]);

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "rooms" && segments[1]) {
      const roomId = Number(segments[1]);
      setView(Number.isFinite(roomId) ? { type: "room", id: roomId } : null);
      setSection("rooms");

    } else if (segments[0] === "conversations" && segments[1]) {
      setView({ type: "dm", username: decodeURIComponent(segments[1]) });
      setInboxTab("conversations");
      setSection("messages");
    } else if (pathname === "/direct-messages") {
      setView(null);
      setInboxTab("users");
      setSection("messages");
    } else if (pathname === "/conversations") {
      setView(null);
      setInboxTab("conversations");
      setSection("messages");
    } else {
      setView(null);
      setSection("rooms");
    }
  }, [pathname]);

  const loadMessages = useCallback(async (target: View, token: string, after?: string | null) => {
    const suffix = after ? `?after=${encodeURIComponent(after)}` : "";
    const path = target.type === "room" ? `/rooms/${target.id}/messages${suffix}` : `/dm/${encodeURIComponent(target.username)}${suffix}`;
    return request<Message[]>(path, token);
  }, []);

  useEffect(() => {
    if (!session || !view) { setMessages([]); return; }
    let active = true;
    cursorRef.current = null; setMessages([]); setNotice("");
    loadMessages(view, session.token).then((data) => {
      if (!active) return;
      setMessages(data); cursorRef.current = data.at(-1)?.created_at || new Date().toISOString();
    }).catch(async (error: Error) => {
      if (!active) return;
      setNotice(error.message);
      if (view.type === "room" && error.message.includes("not found")) {
        await refreshLists(session.token).catch(() => undefined); setView(null);
      }
    });
    const interval = window.setInterval(async () => {
      if (!active || !cursorRef.current) return;
      try {
        const lastSeen = new Date(cursorRef.current).getTime();
        const pollFrom = new Date(Math.max(0, lastSeen - 2000)).toISOString();
        const data = await loadMessages(view, session.token, pollFrom);
        if (!active || !data.length) return;
        setMessages((existing) => [...existing, ...data.filter((item) => !existing.some((old) => old.id === item.id))]);
        const latestTimestamp = Math.max(lastSeen, ...data.map((item) => new Date(item.created_at).getTime()));
        cursorRef.current = new Date(latestTimestamp).toISOString();
      } catch (error) {
        if (!active) return;
        setNotice((error as Error).message);
        if (view.type === "room") refreshLists(session.token).then(() => setView(null)).catch(() => undefined);
      }
    }, 4000);
    return () => { active = false; window.clearInterval(interval); };
  }, [session, view, loadMessages, refreshLists]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function saveSession(value: Session) { localStorage.setItem("little-talk-session", JSON.stringify(value)); setSession(value); setNotice(""); }
  function signOut() { localStorage.removeItem("little-talk-session"); setSession(null); setView(null); setMessages([]); setRooms([]); setConversations([]); setBlocked([]); setUserDirectory([]); }

  async function register(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    try { const data = await request<Session & { created_at: string }>("/register", undefined, { method: "POST", body: JSON.stringify({ username: username.trim() }) }); saveSession({ username: data.username, token: data.token }); }
    catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }

  async function createRoom(event: FormEvent) {
    event.preventDefault(); if (!session || !newRoom.trim()) return; setBusy(true);
    try { const room = await request<Room>("/rooms", session.token, { method: "POST", body: JSON.stringify({ name: newRoom.trim() }) }); setRooms((items) => [room, ...items]); setNewRoom(""); setComposer(null); setSection("rooms"); router.push("/rooms"); setNotice(`“${room.name}” was created.`); }
    catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }

  async function sendQuickMessage(event: FormEvent) {
    event.preventDefault();
    const target = dmTarget.trim();
    const body = quickMessage.trim();
    if (!session || !target || target.toLowerCase() === me?.toLowerCase() || !body) return;
    setBusy(true); setNotice("");
    try {
      await request<Message>(`/dm/${encodeURIComponent(target)}`, session.token, { method: "POST", body: JSON.stringify({ body }) });
      setQuickMessage(""); setDmTarget(""); setUserSuggestions([]); setComposer(null); router.push(`/conversations/${encodeURIComponent(target)}`);
      setNotice(`Message sent to @${target}.`);
      refreshLists(session.token).catch(() => undefined);
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault(); if (!session || !view || !draft.trim()) return; setBusy(true); setNotice("");
    const path = view.type === "room" ? `/rooms/${view.id}/messages` : `/dm/${encodeURIComponent(view.username)}`;
    try {
      const message = await request<Message>(path, session.token, { method: "POST", body: JSON.stringify({ body: draft.trim() }) });
      setMessages((items) => items.some((item) => item.id === message.id) ? items : [...items, message]); cursorRef.current = message.created_at; setDraft("");
      if (view.type === "dm") refreshLists(session.token).catch(() => undefined);
    } catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }

  async function blockUser(name: string) {
    if (!session) return;
    try { await request(`/blocks/${encodeURIComponent(name)}`, session.token, { method: "POST" }); setBlocked((items) => [...items, { username: name, blocked_at: new Date().toISOString() }]); setConversations((items) => items.filter((item) => item.username !== name)); setView((current) => current?.type === "dm" && current.username === name ? null : current); setNotice(`${name} is blocked. Their room messages will be hidden.`); }
    catch (error) { setNotice((error as Error).message); }
  }
  async function unblockUser(name: string) {
    if (!session) return;
    try { await request(`/blocks/${encodeURIComponent(name)}`, session.token, { method: "DELETE" }); setBlocked((items) => items.filter((item) => item.username !== name)); setNotice(`${name} has been unblocked.`); }
    catch (error) { setNotice((error as Error).message); }
  }
  async function deleteRoom(room: Room) {
    if (!session) return;
    try { await request(`/rooms/${room.id}`, session.token, { method: "DELETE" }); setRooms((items) => items.filter((item) => item.id !== room.id)); if (view?.type === "room" && view.id === room.id) setView(null); setNotice(`“${room.name}” was deleted.`); }
    catch (error) { setNotice((error as Error).message); }
  }

  const activeRoom = view?.type === "room" ? rooms.find((room) => room.id === view.id) : undefined;
  const title = activeRoom?.name || (view?.type === "dm" ? view.username : pathname === "/conversations" ? "Conversations" : pathname === "/direct-messages" ? "Direct messages" : pathname === "/rooms" ? "Chat rooms" : "All rooms");
  const messagePeople = [...new Set([
    ...userDirectory,
    ...conversations.map((conversation) => conversation.username),
    ...rooms.map((room) => room.created_by),
    ...messages.map((message) => message.sender),
  ])].filter((name) => name && name.toLowerCase() !== me?.toLowerCase() && !blocked.some((item) => item.username.toLowerCase() === name.toLowerCase()));
  const sortedRooms = [...rooms].sort((a, b) => {
    if (roomSort === "az" || roomSort === "za") {
      const aStartsWithLetter = /^[a-z]/i.test(a.name.trim());
      const bStartsWithLetter = /^[a-z]/i.test(b.name.trim());
      if (aStartsWithLetter !== bStartsWithLetter) return aStartsWithLetter ? -1 : 1;
      const alphabeticalOrder = a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base", numeric: true });
      return roomSort === "az" ? alphabeticalOrder : -alphabeticalOrder;
    }
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return roomSort === "newest" ? bTime - aTime : aTime - bTime;
  });

  if (!ready) return <main className="loading-screen"><span className="brand-mark">✳</span></main>;

  if (!session) return <WelcomeScreen username={username} busy={busy} notice={notice} onUsernameChange={setUsername} onSubmit={register} />

  return <main className="app-shell">
    <ChatSidebar me={me || ""} section={section} rooms={rooms} conversations={conversations} blocked={blocked} messagePeople={messagePeople} view={view} unreadPeople={unreadPeople} moreOpen={moreOpen} onToggleMore={() => setMoreOpen((open) => !open)} onNotice={setNotice} onCreateRoom={() => { setComposer("room"); setNotice(""); }} onShowHome={() => router.push("/")} onShowRooms={() => router.push("/rooms")} onShowConversations={() => router.push("/conversations")} onSelectRoom={(room) => router.push(`/rooms/${room.id}`)} onDeleteRoom={deleteRoom} onShowMessages={() => router.push("/direct-messages")} onNewMessage={() => { setDmTarget(""); setQuickMessage(""); setComposer("dm"); setNotice(""); }} onSelectPerson={(person) => router.push(`/conversations/${encodeURIComponent(person)}`)} onSignOut={signOut} />

    <section className="chat-panel">
      <header className="topbar"><button className="mobile-brand" onClick={() => router.push(section === "rooms" ? "/direct-messages" : "/rooms")}><span>‹</span> {section === "rooms" ? "Chat Room" : "Messages"}</button><div className="crumb"><a className="crumb-home-link" href="/">{view?.type === "dm" ? (pathname.startsWith("/conversations") ? "CONVERSATIONS" : "DIRECT MESSAGES") : pathname === "/" ? "HOME" : "CHAT ROOM"}</a><b>/</b><strong>{title}</strong></div><div className="topbar-right" /> </header>
      {notice && <div className={`notice-bar ${notice.includes("expired") || notice.includes("Invalid") ? "notice-danger" : ""}`}><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
      {incomingPopup && <div role="status" aria-live="polite" style={{ position: "fixed", top: 20, right: 20, zIndex: 100, width: "min(360px, calc(100vw - 40px))", padding: 16, border: "1px solid #526044", borderRadius: 8, background: "#20251e", color: "#eef0e5", boxShadow: "0 12px 36px #0009" }}><div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}><button type="button" onClick={() => { router.push(`/conversations/${encodeURIComponent(incomingPopup.username)}`); setIncomingPopup(null); }} style={{ flex: 1, padding: 0, border: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer" }}><strong style={{ display: "block", marginBottom: 6, color: "#c5f36a", fontSize: 13 }}>New message from @{incomingPopup.username}</strong><span style={{ display: "block", overflow: "hidden", fontSize: 12, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{incomingPopup.body}</span></button><button type="button" aria-label="Dismiss notification" onClick={() => setIncomingPopup(null)} style={{ border: 0, background: "transparent", color: "#aab29d", fontSize: 18, cursor: "pointer" }}>×</button></div></div>}
      {composer === "room" && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setComposer(null); }} style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.68)" }}><form role="dialog" aria-modal="true" aria-labelledby="create-room-title" onSubmit={createRoom} style={{ width: "min(100%, 420px)", padding: 24, border: "1px solid #3a4135", borderRadius: 8, background: "#191d18", color: "#eef0e5", boxShadow: "0 24px 70px #0009" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}><h2 id="create-room-title" style={{ margin: 0, fontSize: 20 }}>Create a room</h2><button type="button" aria-label="Close" onClick={() => setComposer(null)} style={{ border: 0, background: "transparent", color: "#aab29d", fontSize: 22, cursor: "pointer" }}>×</button></div><label htmlFor="new-room-name" style={{ display: "block", marginBottom: 8, color: "#aab29d", fontSize: 12 }}>Room name</label><input id="new-room-name" autoFocus required value={newRoom} onChange={(event) => setNewRoom(event.target.value)} placeholder="Give your room a name" maxLength={48} style={{ width: "100%", height: 44, padding: "0 12px", border: "1px solid #3a4135", borderRadius: 4, background: "#111410", color: "#eef0e5", fontSize: 13 }} /><div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}><button type="button" onClick={() => setComposer(null)} style={{ minHeight: 40, padding: "0 14px", border: "1px solid #3a4135", borderRadius: 4, background: "transparent", color: "#d0d5c8", cursor: "pointer" }}>Cancel</button><button type="submit" disabled={busy || !newRoom.trim()} style={{ minHeight: 40, padding: "0 16px", border: 0, borderRadius: 4, background: "#c5f36a", color: "#1b2417", fontWeight: 700, cursor: "pointer" }}>{busy ? "Creating…" : "Create room"}</button></div></form></div>}
      {composer === "dm" && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setComposer(null); }} style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.68)" }}><form role="dialog" aria-modal="true" aria-labelledby="new-message-title" onSubmit={sendQuickMessage} style={{ width: "min(100%, 440px)", padding: 24, border: "1px solid #3a4135", borderRadius: 8, background: "#191d18", color: "#eef0e5", boxShadow: "0 24px 70px #0009" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}><h2 id="new-message-title" style={{ margin: 0, fontSize: 20 }}>New message</h2><button type="button" aria-label="Close" onClick={() => setComposer(null)} style={{ border: 0, background: "transparent", color: "#aab29d", fontSize: 22, cursor: "pointer" }}>×</button></div><label htmlFor="dm-username" style={{ display: "block", marginBottom: 8, color: "#aab29d", fontSize: 12 }}>Find a person by username</label><input id="dm-username" autoFocus={!dmTarget} value={dmTarget} onChange={(event) => setDmTarget(event.target.value.replace(/\s/g, ""))} placeholder="Start typing a username…" style={{ width: "100%", height: 44, padding: "0 12px", border: "1px solid #3a4135", borderRadius: 4, background: "#111410", color: "#eef0e5", fontSize: 13 }} />{(userSuggestions.length > 0 || searchingUsers) && <div style={{ marginTop: 8, maxHeight: 240, overflowY: "auto", border: "1px solid #30362c", borderRadius: 4 }}>{searchingUsers && <div style={{ padding: 10, color: "#969d8e", fontSize: 11 }}>Searching…</div>}{userSuggestions.map((name) => <button type="button" key={name} onClick={() => { setDmTarget(name); setUserSuggestions([]); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 42, padding: "0 10px", border: 0, borderBottom: "1px solid #30362c", background: "#20251e", color: "#eef0e5", textAlign: "left", cursor: "pointer" }}><Avatar name={name} small /><span>@{name}</span><span style={{ marginLeft: "auto", color: "#c5f36a" }}>Open chat →</span></button>)}</div>}<label htmlFor="quick-message-body" style={{ display: "block", margin: "14px 0 8px", color: "#aab29d", fontSize: 12 }}>Your message</label><textarea id="quick-message-body" autoFocus={!!dmTarget} rows={3} value={quickMessage} onChange={(event) => setQuickMessage(event.target.value)} placeholder={`Write a message to @${dmTarget || "username"}?`} style={{ width: "100%", minHeight: 88, padding: 12, resize: "vertical", border: "1px solid #3a4135", borderRadius: 4, background: "#111410", color: "#eef0e5", fontSize: 13 }} /><p style={{ margin: "8px 0 0", color: "#858d7d", fontSize: 10 }}>Your message will be sent directly to this person.</p><div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}><button type="button" onClick={() => setComposer(null)} style={{ minHeight: 40, padding: "0 14px", border: "1px solid #3a4135", borderRadius: 4, background: "transparent", color: "#d0d5c8", cursor: "pointer" }}>Cancel</button><button type="submit" disabled={busy || !dmTarget.trim() || dmTarget.trim().toLowerCase() === me?.toLowerCase() || !quickMessage.trim()} style={{ minHeight: 40, padding: "0 16px", border: 0, borderRadius: 4, background: "#c5f36a", color: "#1b2417", fontWeight: 700, cursor: "pointer" }}>Send message</button></div></form></div>}
      {view ? <>
        <div className="conversation-head"><div className="conversation-identity">{view.type === "room" ? <span className="room-icon">#</span> : <Avatar name={title} />}<div><h1>{title}</h1><p>{view.type === "room" ? <>A space for good conversation <span>·</span> messages are public to room members</> : <>A little one-to-one corner</>}</p></div></div><div className="conversation-actions">{view.type === "dm" && <button className="soft-action" onClick={() => blockUser(view.username)}>Block user</button>}<button className="soft-action" onClick={() => session && refreshLists(session.token).catch((error) => setNotice(error.message))}>↻ <span>Refresh</span></button></div></div>
        <div className="messages-scroll">{messages.length === 0 ? <div className="empty-conversation"><span className="empty-spark">✳</span><h2>{view.type === "room" ? `A fresh start in ${title}` : `Say hello to ${title}`}</h2><p>{view.type === "room" ? "Every good room starts with one message." : "Send the first message and see where it goes."}</p></div> : <div className="message-list">{messages.map((message, index) => { const previous = messages[index - 1]; const grouped = previous?.sender === message.sender && new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < 300000; const own = message.sender === me; return <article className={`message ${grouped ? "grouped" : ""} ${own ? "own-message" : ""}`} key={message.id}>{!grouped && <Avatar name={message.sender} small />}<div className="message-content">{!grouped && <div className="message-byline">{own ? <strong>You</strong> : <button type="button" className="message-user-link" title={`Message @${message.sender}`} onClick={() => { setDmTarget(message.sender); setQuickMessage(""); setComposer("dm"); }}>{message.sender}</button>}<time>{timeLabel(message.created_at)}</time></div>}<p>{message.body}</p></div></article>; })}<div ref={bottomRef} /></div>}</div>
        <div className="composer-wrap"><form className="message-composer" onSubmit={sendMessage}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Write a message ${view.type === "room" ? `to #${title}` : `to ${title}`}…`} rows={1} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(event); } }} /><div className="composer-tools"><span>Be kind, keep it human <span>♡</span></span><div><span className="enter-hint">↵</span><button className="send-button" title="Send message" disabled={!draft.trim() || busy}>↑</button></div></div></form><div className="composer-foot">Messages disappear when a room has been quiet for 24 hours.</div></div>
      </> : section === "messages" ? <div className="room-directory" style={{ display: "block", flex: 1, overflowY: "auto", padding: "48px clamp(20px, 7vw, 88px)", background: "#111410" }}><div className="room-directory-heading" style={{ maxWidth: 760, margin: "0 auto 24px" }}><span className="eyebrow">YOUR INBOX</span><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap", margin: "9px 0 6px" }}><h1 style={{ margin: 0, color: "#f2f2e9", fontSize: 30, fontWeight: 550 }}>Messages</h1><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" onClick={() => { setDmTarget(""); setQuickMessage(""); setComposer("dm"); setNotice(""); }} style={{ minHeight: 40, padding: "0 16px", border: 0, borderRadius: 4, background: "#c5f36a", color: "#1b2417", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ New message</button></div></div><p style={{ margin: 0, color: "#969d8e", fontSize: 12 }}>{inboxTab === "users" ? `${messagePeople.length} usernames available` : `Your latest conversations, up to ${Math.min(conversations.length, 100)}.`}</p><div role="tablist" aria-label="Messages list" style={{ display: "flex", gap: 8, marginTop: 18 }}><button type="button" role="tab" aria-selected={inboxTab === "conversations"} onClick={() => { setInboxTab("conversations"); router.push("/conversations"); }} style={{ minHeight: 36, padding: "0 14px", border: "1px solid #3a4135", borderRadius: 4, background: inboxTab === "conversations" ? "#c5f36a" : "#191d18", color: inboxTab === "conversations" ? "#1b2417" : "#eef0e5", cursor: "pointer" }}>Conversations</button><button type="button" role="tab" aria-selected={inboxTab === "users"} onClick={() => { setInboxTab("users"); router.push("/direct-messages"); }} style={{ minHeight: 36, padding: "0 14px", border: "1px solid #3a4135", borderRadius: 4, background: inboxTab === "users" ? "#c5f36a" : "#191d18", color: inboxTab === "users" ? "#1b2417" : "#eef0e5", cursor: "pointer" }}>All usernames</button></div></div>{inboxTab === "users" ? (messagePeople.length ? <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 760, margin: "0 auto" }}>{messagePeople.map((person) => <button type="button" key={person} onClick={() => router.push(`/conversations/${encodeURIComponent(person)}`)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", minHeight: 64, padding: "12px 16px", border: "1px solid #30362c", borderRadius: 5, background: "#191d18", color: "#eef0e5", textAlign: "left", cursor: "pointer" }}><Avatar name={person} /><strong style={{ flex: 1, fontSize: 13 }}>@{person}</strong><span style={{ color: "#c5f36a", fontSize: 11 }}>Message ?</span></button>)}</div> : <div className="room-directory-empty"><h2>No usernames found</h2></div>) : conversations.length ? <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 760, margin: "0 auto" }}>{conversations.slice(0, 100).map((conversation) => <button type="button" key={conversation.username} onClick={() => router.push(`/conversations/${encodeURIComponent(conversation.username)}`)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", minHeight: 72, padding: "12px 16px", border: "1px solid #30362c", borderRadius: 5, background: "#191d18", color: "#eef0e5", textAlign: "left", cursor: "pointer" }}><Avatar name={conversation.username} /><span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}><strong style={{ fontSize: 13 }}>@{conversation.username}</strong><small style={{ overflow: "hidden", color: "#969d8e", fontSize: 11, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conversation.last_message?.body || "Start a conversation"}</small></span><small style={{ color: "#969d8e", fontSize: 10 }}>{timeLabel(conversation.last_message?.created_at)}</small></button>)}</div> : <div className="room-directory-empty"><span className="empty-spark">?</span><h2>No messages yet</h2><p>Start a conversation with someone.</p></div>}</div> : <div className="room-directory" style={{ display: "block", flex: 1, overflowY: "auto", padding: "48px clamp(20px, 7vw, 88px)", background: "#111410" }}><div className="room-directory-heading" style={{ maxWidth: 760, margin: "0 auto 24px" }}><span className="eyebrow">LITTLE TALK COMMUNITY</span><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap", margin: "9px 0 6px" }}><h1 style={{ margin: 0, color: "#f2f2e9", fontSize: 30, fontWeight: 550 }}>{pathname === "/" ? "Explore rooms" : "Chat rooms"}</h1><div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}><div style={{ position: "relative", zIndex: 30 }} onMouseLeave={() => setAlphaMenuOpen(false)}><button type="button" aria-haspopup="menu" aria-expanded={sortMenuOpen} onClick={() => setSortMenuOpen((open) => !open)} style={{ minHeight: 40, minWidth: 145, padding: "0 12px", display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid #3a4135", borderRadius: 4, background: "#191d18", color: "#eef0e5", fontSize: 12, cursor: "pointer" }}>Sort: {roomSort === "newest" ? "Newest" : roomSort === "oldest" ? "Oldest" : roomSort === "az" ? "A - Z" : roomSort === "za" ? "Z - A" : "Time"}<span aria-hidden="true" style={{ color: "#c5f36a" }}>&#9662;</span></button>{sortMenuOpen && <div role="menu" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 170, padding: 5, border: "1px solid #3a4135", borderRadius: 5, background: "#191d18", boxShadow: "0 10px 28px #0008" }}>{(["newest", "oldest", "alphabetic"] as const).map((option) => option === "alphabetic" ? <div key={option} style={{ position: "relative" }} onMouseEnter={() => setAlphaMenuOpen(true)}><button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={alphaMenuOpen} onClick={() => setAlphaMenuOpen((open) => !open)} style={{ width: "100%", minHeight: 38, padding: "0 10px", display: "flex", alignItems: "center", justifyContent: "space-between", border: 0, borderRadius: 3, background: "transparent", color: "#dce1d4", textAlign: "left", fontSize: 12, cursor: "pointer" }}>Alphabetic <span style={{ color: "#c5f36a" }}>&#8250;</span></button>{alphaMenuOpen && <div role="menu" style={{ position: "absolute", top: 0, left: "calc(100% + 5px)", width: 110, padding: 5, border: "1px solid #3a4135", borderRadius: 5, background: "#191d18", boxShadow: "0 10px 28px #0008" }}>{(["az", "za"] as const).map((order) => <button key={order} type="button" role="menuitem" onClick={() => { setRoomSort(order); setSortMenuOpen(false); setAlphaMenuOpen(false); }} style={{ width: "100%", minHeight: 38, padding: "0 10px", border: 0, borderRadius: 3, background: "transparent", color: "#dce1d4", textAlign: "left", fontSize: 12, cursor: "pointer" }}>{order === "az" ? "A - Z" : "Z - A"}</button>)}</div>}</div> : <button key={option} type="button" role="menuitem" onClick={() => { setRoomSort(option === "newest" ? "newest" : "oldest"); setSortMenuOpen(false); }} style={{ width: "100%", minHeight: 38, padding: "0 10px", display: "block", border: 0, borderRadius: 3, background: "transparent", color: "#dce1d4", textAlign: "left", fontSize: 12, cursor: "pointer" }}>{option === "newest" ? "Newest" : option === "oldest" ? "Oldest" : "Time"}</button>)}</div>}</div><button type="button" onClick={() => { setNotice(""); setComposer("room"); }} style={{ minHeight: 40, padding: "0 16px", border: 0, borderRadius: 4, background: "#c5f36a", color: "#1b2417", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>+ Create room</button></div></div><p style={{ margin: 0, color: "#969d8e", fontSize: 12 }}>Pick a space and join the conversation.</p></div>{sortedRooms.length ? <div className="room-list" style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 760, margin: "0 auto" }}>{sortedRooms.map((room) => <div className="room-list-row" key={room.id} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", minHeight: 72, padding: "12px 16px", border: "1px solid #30362c", borderRadius: 5, background: "#191d18", color: "#eef0e5" }}><span className="room-directory-hash">#</span><div className="room-directory-copy" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}><strong style={{ fontSize: 13 }}>{room.name}</strong><small style={{ color: "#969d8e", fontSize: 10 }}>Created by @{room.created_by} &#183; {roomCreatedLabel(room.created_at)}</small></div><button type="button" className="room-open-button" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 116, minHeight: 40, padding: "0 14px", border: 0, borderRadius: 4, background: "#c5f36a", color: "#1b2417", fontSize: 12, fontWeight: 700, cursor: "pointer" }} onClick={() => router.push(`/rooms/${room.id}`)}>Open room <span aria-hidden="true">&#8594;</span></button></div>)}</div> : <div className="room-directory-empty"><span className="empty-spark">&#10033;</span><h2>No rooms yet</h2><p>Create a room to start the first conversation.</p></div>}</div>}
    </section>
    <RightRail me={me || ""} blocked={blocked} onCopyUsername={() => { navigator.clipboard?.writeText(`@${me}`); setNotice("Username copied."); }} onUnblock={unblockUser} />
  </main>;
}
