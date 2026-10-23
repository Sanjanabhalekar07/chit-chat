import Avatar from "./avatar";
import type { Blocked } from "./chat-sidebar";

type RightRailProps = {
  me: string;
  blocked: Blocked[];
  onCopyUsername: () => void;
  onUnblock: (username: string) => void;
};

export default function RightRail({ me, blocked, onCopyUsername, onUnblock }: RightRailProps) {
  return (
    <aside className="right-rail">
      <div className="rail-top"><span>✳</span> a note for today</div>
      <div className="quote-card"><span className="quote-mark">“</span><p>Somewhere, someone is having a day that would be better with you in it.</p><span className="quote-flower">✿</span><small>PASS IT ON</small></div>
      <div className="rail-block">
        <div className="rail-label">YOUR CORNER</div>
        <div className="corner-card"><Avatar name={me || "?"} /><div><strong>@{me}</strong><small>Your guest space</small></div><span className="corner-dot" /></div>
        <button className="copy-name" onClick={onCopyUsername}>Copy your username <span>↗</span></button>
      </div>
      <div className="rail-block block-list">
        <div className="rail-label">BLOCKED USERS <span>{blocked.length}</span></div>
        {blocked.length ? blocked.map((item) => <div className="blocked-row" key={item.username}><Avatar name={item.username} small /><span>{item.username}</span><button onClick={() => onUnblock(item.username)}>Undo</button></div>) : <p>No one here. Your corner is peaceful.</p>}
      </div>
      <div className="rail-bottom"><span>✳</span> little talk <span className="rail-version">guest chat · v1</span></div>
    </aside>
  );
}
