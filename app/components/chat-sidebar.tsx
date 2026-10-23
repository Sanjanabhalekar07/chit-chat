import Avatar from "./avatar";

export type Room = { id: number; name: string; created_by: string; created_at: string };
export type Blocked = { username: string; blocked_at: string };
export type View = { type: "room"; id: number } | { type: "dm"; username: string };
type Conversation = { username: string };

type ChatSidebarProps = {
  me: string;
  section: "rooms" | "messages";
  rooms: Room[];
  conversations: Conversation[];
  blocked: Blocked[];
  messagePeople: string[];
  view: View | null;
  unreadPeople: Set<string>;
  moreOpen: boolean;
  onToggleMore: () => void;
  onNotice: (message: string) => void;
  onCreateRoom: () => void;
  onShowHome: () => void;
  onShowRooms: () => void;
  onShowConversations: () => void;
  onSelectRoom: (room: Room) => void;
  onDeleteRoom: (room: Room) => void;
  onShowMessages: () => void;
  onNewMessage: () => void;
  onSelectPerson: (person: string) => void;
  onSignOut: () => void;
};

export default function ChatSidebar(props: ChatSidebarProps) {
  const { me, section, rooms, conversations, blocked, messagePeople, view, unreadPeople, moreOpen } = props;

  return (
    <aside className={`sidebar ${section === "rooms" ? "sidebar-visible" : ""}`}>
      <div className="side-brand-wrap">
        <div className="side-brand"><button type="button" className="brand-home" onClick={props.onShowHome}><span className="brand-mark">✳</span><span>little talk</span></button><button className="more-button" title="More options" aria-label="More options" aria-expanded={moreOpen} onClick={props.onToggleMore}>⋯</button></div>
        {moreOpen && <div className="more-menu" role="region" aria-label="More options"><strong>Account details</strong><div><span>Signed in as</span><b>@{me}</b></div><div><span>Spaces</span><b>{rooms.length}</b></div><div><span>Conversations</span><b>{conversations.length}</b></div><div><span>Blocked users</span><b>{blocked.length}</b></div></div>}
      </div>
      <button className="profile-card" onClick={() => props.onNotice(`You’re here as @${me}. Your guest session lasts while you stay active.`)}><Avatar name={me || "?"} /><span className="profile-meta"><strong>@{me}</strong><small><i /> Here for a chat</small></span><span className="chevron">⌄</span></button>
      <div className="side-section">
        <div className="section-heading"><button type="button" className="chat-room-home-link" onClick={props.onShowRooms}>CHAT ROOM</button><button onClick={props.onCreateRoom} title="Create a room">＋</button></div>
        <div className="nav-list">{rooms.map((room) => <div className={`nav-row ${view?.type === "room" && view.id === room.id ? "selected" : ""}`} key={room.id}><button className="nav-main" onClick={() => props.onSelectRoom(room)}><span className="hash">#</span><span>{room.name}</span></button>{room.created_by === me && <button className="row-action" title="Delete room" onClick={() => props.onDeleteRoom(room)}>×</button>}</div>)}{!rooms.length && <div className="empty-sidebar">No rooms yet. Start one?</div>}</div>
      </div>
      <div className="side-section dm-section">
        <div className="section-heading"><button type="button" className="chat-room-home-link" onClick={props.onShowMessages}>MESSAGES</button><span style={{ display: "flex", alignItems: "center", gap: 8 }}><button type="button" className="chat-room-home-link" onClick={props.onShowConversations} style={{ fontSize: 9, letterSpacing: 1 }}>CHATS</button><button onClick={props.onNewMessage} title="New message">＋</button></span></div>
        <div className="nav-list">{messagePeople.map((person) => <button className={`nav-row nav-main ${view?.type === "dm" && view.username === person ? "selected" : ""}`} key={person} onClick={() => props.onSelectPerson(person)}><Avatar name={person} small /><span className="dm-name">{person}</span>{unreadPeople.has(person.toLowerCase()) && <i className="unread-dot" />}</button>)}{!messagePeople.length && <div className="empty-sidebar">Your one-to-one chats live here.</div>}</div>
      </div>
      <div className="side-spacer" />
      <button type="button" className="sidebar-signout" aria-label="Sign out of your account" onClick={props.onSignOut}><span className="sidebar-signout-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></svg></span><span className="sidebar-signout-label">Sign out</span></button>
      <div className="side-bottom"><span className="online-dot" /> A little room to connect <span>✳</span></div>
    </aside>
  );
}
