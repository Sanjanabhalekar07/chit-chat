export const API = "https://chatapp.adnecto.in/api";

export type Session = { username: string; token: string };
export type Room = { id: number; name: string; created_by: string; created_at: string };
export type Message = { id: number; sender: string; room_id: number | null; recipient: string | null; body: string; created_at: string };
export type Conversation = { username: string; last_message: { body: string; sender: string; created_at: string } | null };

export async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `Request failed (${response.status})`);
  return result.data as T;
}

export function extractUsernames(payload: unknown): string[] {
  if (Array.isArray(payload)) return payload.flatMap((user) => {
    if (typeof user === "string") return [user];
    if (!user || typeof user !== "object") return [];
    const record = user as Record<string, unknown>;
    const name = record.username ?? record.user_name ?? record.handle ?? record.name;
    return typeof name === "string" ? [name] : [];
  });
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of [
    "users",
    "results",
    "data",
    "items",
    "blocks",
    "blocked",
    "blocked_users",
    "blockedUsers",
  ]) {
    const names = extractUsernames(record[key]);
    if (names.length) return names;
  }
  return [];
}

export function timeLabel(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
