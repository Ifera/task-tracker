import { useState, type CSSProperties, type FormEvent } from "react";
import { signIn, signUp } from "../lib/auth";

interface Props {
  onAuth: () => void;
}

export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setError("");
    setPassword("");
    setConfirm("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = username.trim();
    if (!trimmed) { setError("Username is required."); return; }
    if (!password) { setError("Password is required."); return; }

    if (mode === "signup") {
      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
      if (password !== confirm) { setError("Passwords do not match."); return; }
    }

    setLoading(true);
    try {
      const { error: err } =
        mode === "signup"
          ? await signUp(trimmed, password)
          : await signIn(trimmed, password);

      if (err) throw err;
      onAuth();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already registered")) {
        setError("Username already taken. Choose another.");
      } else if (msg.includes("Invalid login credentials")) {
        setError("Incorrect username or password.");
      } else {
        setError(msg || "Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const s: Record<string, CSSProperties> = {
    root: {
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0D2137 0%, #1A3A5C 60%, #1A5276 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: 16,
    },
    card: {
      background: "#fff",
      borderRadius: 16,
      padding: "36px 28px 28px",
      width: "100%",
      maxWidth: 380,
      boxShadow: "0 8px 40px #0004",
    },
    brand: {
      textAlign: "center",
      marginBottom: 28,
    },
    appName: {
      fontSize: 24,
      fontWeight: 900,
      color: "#0D2137",
      letterSpacing: 0.5,
    },
    army: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 2.5,
      color: "#7F8C8D",
      marginTop: 3,
    },
    heading: {
      fontSize: 16,
      fontWeight: 800,
      color: "#1A2533",
      marginBottom: 22,
      textAlign: "center",
    },
    label: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 0.8,
      color: "#7F8C8D",
      display: "block",
      marginBottom: 5,
    },
    input: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 8,
      border: "1.5px solid #D5DCE8",
      fontSize: 14,
      background: "#F9FAFB",
      boxSizing: "border-box",
      marginBottom: 14,
      outline: "none",
      fontFamily: "inherit",
      color: "#1A2533",
    },
    btn: {
      width: "100%",
      padding: "12px 0",
      background: "#0D2137",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      fontWeight: 700,
      fontSize: 14,
      cursor: loading ? "not-allowed" : "pointer",
      marginTop: 4,
      opacity: loading ? 0.7 : 1,
      fontFamily: "inherit",
    },
    error: {
      background: "#FDEDEC",
      color: "#C0392B",
      border: "1px solid #C0392B22",
      borderRadius: 8,
      padding: "9px 12px",
      fontSize: 12,
      fontWeight: 600,
      marginBottom: 16,
    },
    toggle: {
      textAlign: "center",
      marginTop: 20,
      fontSize: 13,
      color: "#7F8C8D",
    },
    link: {
      color: "#0D2137",
      fontWeight: 700,
      cursor: "pointer",
      textDecoration: "underline",
      background: "none",
      border: "none",
      fontSize: 13,
      padding: 0,
      fontFamily: "inherit",
    },
  };

  return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={s.brand}>
          <div style={s.appName}>Task Tracker</div>
          <div style={s.army}>PAKISTAN ARMY</div>
        </div>

        <div style={s.heading}>
          {mode === "login" ? "Welcome back" : "Create account"}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {error && <div style={s.error}>{error}</div>}

          <label style={s.label}>USERNAME</label>
          <input
            style={s.input}
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />

          <label style={s.label}>PASSWORD</label>
          <input
            style={s.input}
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {mode === "signup" && (
            <>
              <label style={s.label}>CONFIRM PASSWORD</label>
              <input
                style={s.input}
                type="password"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </>
          )}

          <button style={s.btn} type="submit" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "login"
              ? "Log In"
              : "Create Account"}
          </button>
        </form>

        <div style={s.toggle}>
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                style={s.link}
                type="button"
                onClick={() => switchMode("signup")}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                style={s.link}
                type="button"
                onClick={() => switchMode("login")}
              >
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
