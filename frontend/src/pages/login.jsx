import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 960;
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const tryLogin = async (role) => {
    const response = await fetch("http://localhost:5000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password, role }),
    });
    const data = await response.json();
    return { response, data };
  };

  const handleLogin = async () => {
    try {
      setError("");
      setIsLoading(true);

      const adminAttempt = await tryLogin("admin");
      if (adminAttempt.response.ok) {
        localStorage.setItem("token", adminAttempt.data.token);
        localStorage.setItem("role", "admin");
        localStorage.setItem("loginId", id);
        navigate("/admin");
        return;
      }

      const officerAttempt = await tryLogin("placement_officer");
      if (officerAttempt.response.ok) {
        localStorage.setItem("token", officerAttempt.data.token);
        localStorage.setItem("role", "placement_officer");
        localStorage.setItem("loginId", id);
        navigate("/placement-officer");
        return;
      }

      const studentAttempt = await tryLogin("student");
      if (studentAttempt.response.ok) {
        localStorage.setItem("token", studentAttempt.data.token);
        localStorage.setItem("role", "student");
        localStorage.setItem("loginId", id);
        navigate("/student");
        return;
      }

      throw new Error(
        studentAttempt.data.msg ||
        officerAttempt.data.msg ||
        adminAttempt.data.msg ||
        "Login failed"
      );
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.glowBlue} />
      <div style={styles.glowGreen} />
      <div style={styles.gridOverlay} />

      <div style={{ ...styles.shell, ...(isMobile ? styles.shellMobile : {}) }}>
        <div style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
          <p style={styles.heroKicker}>PLACEMENT COMMAND CENTER</p>
          <h1 style={styles.heroTitle}>Placement Analytics</h1>
          <p style={styles.heroSubtitle}>Evaluate readiness, track progress, and drive outcomes.</p>

          <div style={styles.heroStats}>
            <div style={styles.statTile}>
              <p style={styles.statLabel}>Students</p>
              <p style={styles.statValue}>20</p>
            </div>
            <div style={styles.statTile}>
              <p style={styles.statLabel}>Readiness</p>
              <p style={styles.statValue}>78%</p>
            </div>
          </div>
        </div>

        <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
          <div style={styles.cardHead}>
            <h2 style={styles.title}>Secure Login</h2>
            <p style={styles.subtitle}>Sign in as student or admin</p>
          </div>

          <input
            placeholder="User ID"
            style={styles.input}
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
          <input
            placeholder="Password"
            type="password"
            style={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {!!error && <p style={styles.error}>{error}</p>}

          <button
            style={styles.loginBtn}
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? "Checking..." : "Login"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    height: "100vh",
    background: "linear-gradient(145deg, #020617 0%, #03163a 45%, #053047 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    fontFamily: "Inter, sans-serif",
  },
  glowBlue: {
    position: "absolute",
    width: 540,
    height: 540,
    background: "radial-gradient(circle, rgba(56,189,248,0.24), rgba(56,189,248,0))",
    top: -180,
    left: -140,
  },
  glowGreen: {
    position: "absolute",
    width: 500,
    height: 500,
    background: "radial-gradient(circle, rgba(16,185,129,0.2), rgba(16,185,129,0))",
    bottom: -180,
    right: -120,
  },
  gridOverlay: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
    backgroundSize: "44px 44px",
    maskImage: "radial-gradient(circle at center, black 40%, transparent 100%)",
    pointerEvents: "none",
  },
  shell: {
    position: "relative",
    zIndex: 2,
    width: "min(980px, 92vw)",
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: "20px",
    alignItems: "stretch",
  },
  shellMobile: {
    gridTemplateColumns: "1fr",
    gap: "14px",
  },
  hero: {
    padding: "34px 30px",
    borderRadius: "22px",
    border: "1px solid rgba(103,232,249,0.22)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.82), rgba(15,23,42,0.52))",
    backdropFilter: "blur(12px)",
    boxShadow: "0 18px 45px rgba(0,0,0,0.3)",
    color: "white",
  },
  heroMobile: {
    padding: "24px 22px",
  },
  heroKicker: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "#67e8f9",
  },
  heroTitle: {
    margin: "10px 0 10px 0",
    fontSize: 48,
    lineHeight: 1.05,
    letterSpacing: "-0.02em",
  },
  heroSubtitle: {
    margin: 0,
    color: "#a9bfdc",
    fontSize: 16,
  },
  heroStats: {
    marginTop: "26px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  statTile: {
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(2,6,23,0.45)",
  },
  statLabel: {
    margin: 0,
    color: "#9db2cf",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  statValue: {
    margin: "6px 0 0 0",
    fontSize: 28,
    fontWeight: 700,
    color: "#e2e8f0",
  },

  card: {
    padding: 30,
    borderRadius: 22,
    background: "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(15,23,42,0.62))",
    backdropFilter: "blur(16px)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
    border: "1px solid rgba(125,211,252,0.2)",
    color: "white",
  },
  cardMobile: {
    padding: "24px 22px",
  },
  cardHead: {
    marginBottom: 18,
  },
  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 0,
    color: "#9fb4d4",
    fontSize: 14,
  },
  input: {
    width: "100%",
    padding: 13,
    marginBottom: 14,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.3)",
    background: "rgba(2,6,23,0.65)",
    color: "white",
    outline: "none",
    fontSize: 14,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  },
  loginBtn: {
    width: "100%",
    padding: 12,
    marginTop: 6,
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #38bdf8, #2563eb, #1d4ed8)",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 0.2s ease",
  },
  error: {
    marginTop: "-4px",
    marginBottom: "8px",
    color: "#fca5a5",
    fontSize: "13px",
    textAlign: "left",
  },
};
