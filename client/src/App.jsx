// client/src/App.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

/* Simple inline SVG logo */
function Logo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#0b7c86" />
          <stop offset="1" stopColor="#2aa7a9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="12" fill="url(#g)" />
      <text x="16" y="42" fill="#fff" fontSize="22" fontWeight="700" fontFamily="Inter, Arial, sans-serif">AI</text>
    </svg>
  );
}

/* Drawer that opens from the 3-dot menu */
function ProfileDrawer({ open, profile, onClose, onEdit, onSignOut }) {
  return (
    <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose}>
      <aside className={`drawer ${open ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="brand-box"><Logo size={40} /></div>
          <div>
            <h3 style={{ margin: 0 }}>{profile.name || "User"}</h3>
            <div className="small-muted">{profile.email}</div>
          </div>
        </div>

        <div className="drawer-body">
          <div className="profile-row"><strong>Blood group</strong><span>{profile.blood_group || "-"}</span></div>
          <div className="profile-row"><strong>Critical disease</strong><span>{profile.critical_disease || "None"}</span></div>
          <div className="profile-row"><strong>City</strong><span>{profile.city || "-"}</span></div>
          <div className="profile-row"><strong>Phone</strong><span>{profile.phone || "-"}</span></div>
        </div>

        <div className="drawer-footer">
          <button className="btn-ghost w-full" onClick={onEdit}>Edit / View profile</button>
          <button className="btn-primary w-full" style={{ marginTop: 10 }} onClick={onSignOut}>Sign out</button>
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState("");
  const [showAuth, setShowAuth] = useState(true);
  const [profile, setProfile] = useState({
    name: "", email: "", phone: "", blood_group: "", critical_disease: "", disease_since: "", city: "", consent: true
  });
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const messagesEnd = useRef(null);

  const handleInput = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  const fetchProfile = async (tokenVal) => {
    try {
      const header = tokenVal || token;
      if (!header) return;
      const res = await axios.get("/api/me", { headers: { Authorization: `Bearer ${header}` } });
      if (res.data?.user) setProfile((p) => ({ ...p, ...res.data.user }));
    } catch (e) {
      console.warn("fetchProfile failed", e?.response?.data || e.message);
    }
  };

  const register = async () => {
    try {
      if (!profile.name || !profile.email) return alert("Name and email required");
      const res = await axios.post("/api/register", profile);
      const receivedToken = res.data.token;
      setToken(receivedToken);
      localStorage.setItem("token", receivedToken);
      axios.defaults.headers.common["Authorization"] = `Bearer ${receivedToken}`;
      await fetchProfile(receivedToken);
      setShowAuth(false);
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    }
  };

  const login = async () => {
    try {
      if (!profile.email) return alert("Please enter email");
      const res = await axios.post("/api/login", { email: profile.email });
      const receivedToken = res.data.token;
      setToken(receivedToken);
      localStorage.setItem("token", receivedToken);
      axios.defaults.headers.common["Authorization"] = `Bearer ${receivedToken}`;
      await fetchProfile(receivedToken);
      setShowAuth(false);
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    }
  };

  const logout = () => {
    setToken("");
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    setChat([]);
    setShowAuth(true);
  };

  const send = async () => {
    if (!msg) return;
    if (!token) return alert("Please login first.");
    setChat((c) => [...c, { role: "user", text: msg }]);
    const userMessage = msg;
    setMsg("");
    setLoading(true);
    try {
      const res = await axios.post("/api/chat", { message: userMessage });
      setChat((c) => [...c, { role: "bot", text: res.data.reply }]);
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (stored) {
      setToken(stored);
      axios.defaults.headers.common["Authorization"] = `Bearer ${stored}`;
      fetchProfile(stored);
      setShowAuth(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  /* AUTH SCREEN */
  if (showAuth) {
    return (
      <div className="auth-background">
        <div className="auth-card fade-in">
          <div className="auth-header" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="brand-box"><Logo size={56} /></div>
            <div>
              <h1 style={{ margin: 0 }}>HealthBot</h1>
              <p className="h-intro">Create a secure profile to access the healthcare assistant</p>
            </div>
          </div>

          {/* stacked inputs: full width, one below another */}
          <div className="auth-form">
            <input className="input-custom full-width" placeholder="Full name" value={profile.name} onChange={(e) => handleInput("name", e.target.value)} />
            <input className="input-custom full-width" placeholder="Email address" value={profile.email} onChange={(e) => handleInput("email", e.target.value)} />
            <input className="input-custom full-width" placeholder="Phone number" value={profile.phone} onChange={(e) => handleInput("phone", e.target.value)} />
            <input className="input-custom full-width" placeholder="Blood group (e.g., B+)" value={profile.blood_group} onChange={(e) => handleInput("blood_group", e.target.value)} />
            <input className="input-custom full-width" placeholder="City (e.g., Bhopal)" value={profile.city} onChange={(e) => handleInput("city", e.target.value)} />
            <input className="input-custom full-width" placeholder="Any critical disease (optional)" value={profile.critical_disease} onChange={(e) => handleInput("critical_disease", e.target.value)} />
            <label className="consent-row"><input type="checkbox" checked={profile.consent} onChange={(e) => handleInput("consent", e.target.checked)} /> I consent to store my profile for improving guidance (demo).</label>

            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button onClick={register} className="btn-primary" style={{ flex: 1 }}>Register</button>
              <button onClick={login} className="btn-ghost" style={{ flex: 1 }}>Login</button>
            </div>

            <p className="small-muted" style={{ marginTop: 12, textAlign: "center" }}>By continuing you consent to data use for demo purposes only.</p>
          </div>
        </div>
      </div>
    );
  }

  /* MAIN (chat full-screen panel) */
  return (
    <div className="app-shell">
      <ProfileDrawer
        open={drawerOpen}
        profile={profile}
        onClose={() => setDrawerOpen(false)}
        onEdit={() => { setDrawerOpen(false); alert("Open profile edit (implement form)"); }}
        onSignOut={() => { setDrawerOpen(false); logout(); }}
      />

      <header className="app-header">
        <div className="header-left" style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <div className="brand-box"><Logo size={56} /></div>
          <div>
            <h1 style={{ margin: 0 }}>HealthBot</h1>
            <div className="h-intro">Evidence-aware guidance • Non-prescriptive</div>
          </div>
        </div>

        <div className="header-right" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu">⋮</button>
          <button className="btn-ghost" onClick={() => { if (window.confirm("Sign out?")) logout(); }}>Sign out</button>
        </div>
      </header>

      <main className="main-content-full">
        <div className="panel chat-panel fullwidth fullheight">
          <div className="chat-scroll" role="log" aria-live="polite">
            {chat.length === 0 ? (
              <div className="chat-empty">
                <p style={{ fontWeight: 600 }}>Welcome, {profile.name.split(" ")[0] || "User"} 👋</p>
                <p className="small-muted">Ask about common symptoms or small home-care tips.</p>
              </div>
            ) : (
              chat.map((m, i) => (
                <div key={i} className={`chat-row ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={m.role === "user" ? "bubble-user" : "bubble-bot"}>
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEnd} />
          </div>

          <div className="input-area sticky-input">
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Describe your symptom briefly..."
              className="input-custom"
              aria-label="Message"
            />
            <button onClick={send} className="btn-primary" disabled={loading} style={{ minWidth: 96 }}>
              {loading ? "Processing…" : "Send"}
            </button>
          </div>

          <p className="small-muted" style={{ paddingTop: 6 }}>This assistant is for general awareness only.</p>
        </div>
      </main>

      <footer className="footer small-muted">© {new Date().getFullYear()} HealthBot — Educational use only.</footer>
    </div>
  );
}
