import type { FormEvent } from "react";

type WelcomeScreenProps = {
  username: string;
  busy: boolean;
  notice: string;
  onUsernameChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
};

export default function WelcomeScreen({
  username,
  busy,
  notice,
  onUsernameChange,
  onSubmit,
}: WelcomeScreenProps) {
  return (
    <main className="welcome-page">
      <div className="welcome-art">
        <div className="art-top">
          <span className="brand-mark">✳</span>
          <span>little talk</span>
        </div>
        <div className="art-copy">
          <span className="eyebrow">A softer corner of the internet</span>
          <h1>
            Good conversations
            <br />
            start with <em>hello.</em>
          </h1>
          <p>Find your people, join a room, or take a conversation somewhere quieter.</p>
          <div className="art-bubbles">
            <span className="bubble bubble-one">hey, you made it ☺</span>
            <span className="bubble bubble-two">good to see you!</span>
            <span className="bubble bubble-three">✳</span>
          </div>
        </div>
        <div className="art-footer">No profiles. No pressure. Just people.</div>
      </div>

      <div className="welcome-form-wrap">
        <div className="welcome-form">
          <span className="eyebrow">YOUR SPACE IS WAITING</span>
          <h2>Come on in.</h2>
          <p className="form-intro">
            Pick a unique username to get started. No password needed.
          </p>
          <form onSubmit={onSubmit}>
            <label htmlFor="username">Your username</label>
            <div className="username-input">
              <span>@</span>
              <input
                id="username"
                value={username}
                onChange={(event) =>
                  onUsernameChange(event.target.value.replace(/\s/g, ""))
                }
                placeholder="happy_panda"
                minLength={3}
                maxLength={24}
                pattern="[A-Za-z0-9_]+"
                required
                autoComplete="username"
              />
              <span className="input-check">✳</span>
            </div>
            <small>3–24 characters · letters, numbers, and underscores</small>
            <button className="primary-button welcome-button" disabled={busy}>
              {busy ? "Finding your place…" : "Join the conversation"}
              <span>↗</span>
            </button>
          </form>
          {notice && <p className="notice error-notice">{notice}</p>}
          <p className="privacy-note">
            <span>◈</span> Your username is your identity. Keep your token safe on this
            device.
          </p>
        </div>
        <div className="welcome-bottom">
          By joining, you agree to keep things kind. <span>♡</span>
        </div>
      </div>
    </main>
  );
}
