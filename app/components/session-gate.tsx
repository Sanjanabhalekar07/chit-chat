"use client";

import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import WelcomeScreen from "./welcome-screen";
import { request, type Session } from "../lib/chat-api";

const SessionContext = createContext<{ session: Session; signOut: () => void } | null>(null);
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionGate");
  return value;
}

export default function SessionGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const stored = localStorage.getItem("little-talk-session");
    if (stored) try { setSession(JSON.parse(stored)); } catch { localStorage.removeItem("little-talk-session"); }
    setReady(true);
  }, []);
  function signOut() { localStorage.removeItem("little-talk-session"); setSession(null); }
  async function register(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const data = await request<Session>("/register", undefined, { method: "POST", body: JSON.stringify({ username: username.trim() }) });
      localStorage.setItem("little-talk-session", JSON.stringify(data)); setSession(data);
    } catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }
  if (!ready) {
    return (
      <main className="loading-screen">
        <span className="brand-mark">✳</span>
      </main>
    );
  }

  if (!session) {
    return (
      <WelcomeScreen
        username={username}
        busy={busy}
        notice={notice}
        onUsernameChange={setUsername}
        onSubmit={register}
      />
    );
  }

  return (
    <SessionContext.Provider value={{ session, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}
