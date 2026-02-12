import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const FALLBACK_ACTIVITIES = [
  "Completed mock assessment",
  "Updated resume and portfolio",
  "Attended placement workshop",
  "Applied for internship drive",
];

const departmentMap = {
  CSE: "Computer Science",
  ECE: "Electronics and Communication",
  EEE: "Electrical and Electronics",
  IT: "Information Technology",
  MECH: "Mechanical Engineering",
  CIVIL: "Civil Engineering",
};

const defaultStudent = {
  name: "Sneha Kumar",
  regNo: "PA2400213",
  department: "Computer Science",
  cgpa: 8.56,
  attendance: 91,
  activityPoints: 80,
  arrears: 0,
  semesterPerformance: [],
  skillScores: [],
  recentActivities: [],
};

const toFinite = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSemesterData = (items, cgpaFallback = 0) => {
  if (!Array.isArray(items) || !items.length) {
    const end = Math.min(10, Math.max(0, toFinite(cgpaFallback, 7.5)));
    const start = Math.max(5.8, end - 0.9);
    return Array.from({ length: 6 }, (_, index) => {
      const ratio = index / 5;
      const value = start + (end - start) * ratio;
      return { sem: `S${index + 1}`, cgpa: Number(value.toFixed(2)) };
    });
  }

  return items
    .map((item, index) => {
      const sem = item?.sem ?? item?.semester ?? item?.label ?? `S${index + 1}`;
      const cgpa = toFinite(item?.cgpa ?? item?.gpa ?? item?.value, NaN);
      return {
        sem: String(sem),
        cgpa: Number.isFinite(cgpa) ? Number(cgpa.toFixed(2)) : null,
      };
    })
    .filter((item) => item.cgpa !== null);
};

const normalizeSkillData = (skills, student) => {
  if (Array.isArray(skills) && skills.length) {
    return skills
      .map((item) => {
        const name = item?.name ?? item?.skill ?? "";
        const score = toFinite(item?.score ?? item?.value, NaN);
        return {
          name: String(name).trim(),
          score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null,
        };
      })
      .filter((item) => item.name && item.score !== null);
  }

  const cgpaScore = Math.round((Math.max(0, Math.min(10, toFinite(student.cgpa, 0))) / 10) * 100);
  const attendanceScore = Math.round(Math.max(0, Math.min(100, toFinite(student.attendance, 0))));
  const activityScore = Math.round(Math.max(0, Math.min(100, toFinite(student.activityPoints, 0))));
  const consistency = Math.round((cgpaScore * 0.5) + (attendanceScore * 0.35) + (activityScore * 0.15));

  return [
    { name: "Academic Strength", score: cgpaScore },
    { name: "Attendance Discipline", score: attendanceScore },
    { name: "Engagement", score: activityScore },
    { name: "Placement Readiness", score: Math.max(0, Math.min(100, consistency)) },
  ];
};

const normalizeActivities = (activities) => {
  if (Array.isArray(activities) && activities.length) {
    return activities
      .map((item) => {
        if (typeof item === "string") return item.trim();
        const text = item?.title ?? item?.message ?? item?.activity ?? "";
        return String(text).trim();
      })
      .filter(Boolean);
  }
  return FALLBACK_ACTIVITIES;
};

const normalizeStudent = (raw) => {
  const safe = raw && typeof raw === "object" ? raw : {};
  const departmentCode = String(safe.department || "").toUpperCase();
  const normalized = {
    ...defaultStudent,
    ...safe,
    department: departmentMap[departmentCode] || safe.department || defaultStudent.department,
  };

  normalized.semesterPerformance = normalizeSemesterData(safe.semesterPerformance, safe.cgpa);
  normalized.skillScores = normalizeSkillData(safe.skillScores, normalized);
  normalized.recentActivities = normalizeActivities(safe.recentActivities);

  return normalized;
};

const fetchJson = async (url, token, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { authorization: token, ...(options.headers || {}) },
  });
  const bodyText = await response.text();
  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      (body && (body.msg || body.error)) ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  if (body === null) {
    throw new Error(`Unexpected non-JSON response from ${url}`);
  }

  return body;
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div style={styles.tooltip}>
      <p style={styles.tooltipLabel}>{label}</p>
      <p style={styles.tooltipValue}>CGPA {payload[0].value}</p>
    </div>
  );
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { regNo } = useParams();
  const [showSideActions, setShowSideActions] = useState(false);
  const [student, setStudent] = useState(defaultStudent);
  const [loadError, setLoadError] = useState("");
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const [viewerRole, setViewerRole] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [editDraft, setEditDraft] = useState({
    name: "",
    department: "",
    cgpa: "",
    attendance: "",
    activityPoints: "",
    arrears: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("role");
        setViewerRole(role || "");
        if (!token) {
          navigate("/");
          return;
        }

        let response;
        if (role === "student") {
          response = await fetchJson("http://localhost:5000/api/student/me", token);
          setIsAdminPreview(false);
        } else if ((role === "admin" || role === "placement_officer") && regNo) {
          try {
            response = await fetchJson(`http://localhost:5000/api/students/${encodeURIComponent(regNo)}`, token);
          } catch {
            const allStudents = await fetchJson("http://localhost:5000/api/students", token);
            const match = Array.isArray(allStudents)
              ? allStudents.find((item) => String(item?.regNo || "").toUpperCase() === String(regNo).toUpperCase())
              : null;
            if (!match) throw new Error("Student not found");
            response = match;
          }
          setIsAdminPreview(true);
        } else {
          navigate("/");
          return;
        }

        setStudent(normalizeStudent(response));
        setLoadError("");
      } catch (error) {
        setLoadError(error.message || "Failed to load student profile");
      }
    };

    fetchProfile();
  }, [navigate, regNo]);

  useEffect(() => {
    setEditDraft({
      name: student.name || "",
      department: student.department || "",
      cgpa: String(student.cgpa ?? ""),
      attendance: String(student.attendance ?? ""),
      activityPoints: String(student.activityPoints ?? ""),
      arrears: String(student.arrears ?? ""),
    });
  }, [student]);

  const canEdit = isAdminPreview && viewerRole === "placement_officer";

  const saveStudentDetails = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token || !regNo) return;
      setSaveMessage("Saving...");

      const payload = {
        name: editDraft.name.trim(),
        department: editDraft.department.trim(),
        cgpa: Number(editDraft.cgpa),
        attendance: Number(editDraft.attendance),
        activityPoints: Number(editDraft.activityPoints),
        arrears: Number(editDraft.arrears),
      };

      const data = await fetchJson(
        `http://localhost:5000/api/students/${encodeURIComponent(regNo)}`,
        token,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      setStudent(normalizeStudent(data));
      setIsEditing(false);
      setSaveMessage("Updated successfully");
    } catch (error) {
      setSaveMessage(error.message || "Update failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("loginId");
    navigate("/");
  };

  const cards = [
    { title: "CGPA", value: student.cgpa?.toFixed(2) ?? "N/A", tone: "blue", note: "Current semester" },
    { title: "Attendance", value: `${student.attendance ?? 0}%`, tone: "green", note: "Overall" },
    { title: "Activity Points", value: student.activityPoints ?? 0, tone: "cyan", note: "Co-curricular" },
    { title: "Arrears", value: student.arrears ?? 0, tone: "rose", note: "Pending backlogs" },
  ];

  const isReady = (student.cgpa || 0) >= 8 && (student.attendance || 0) >= 75 && (student.arrears || 0) === 0;
  const semesterData = student.semesterPerformance || [];
  const skillData = student.skillScores || [];
  const activityFeed = student.recentActivities || [];

  return (
    <motion.div style={styles.page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div style={styles.bgOrbOne} />
      <div style={styles.bgOrbTwo} />
      <div style={styles.bgGrid} />

      <aside style={styles.sidebar}>
        <h2 style={styles.logo}>PA</h2>
        <button type="button" style={styles.menuToggle} onClick={() => setShowSideActions((prev) => !prev)}>
          {showSideActions ? "Close" : "Menu"}
        </button>

        <nav
          style={{
            ...styles.nav,
            ...(showSideActions ? styles.navOpen : styles.navClosed),
          }}
        >
          <motion.button
            type="button"
            onClick={handleLogout}
            style={{ ...styles.menuButton, ...styles.logoutButton }}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            Logout
          </motion.button>
        </nav>
      </aside>

      <main style={styles.main}>
        {isAdminPreview && (
          <div style={styles.previewBanner}>
            {viewerRole === "placement_officer" ? "Placement officer" : "Admin"} preview mode for {student.name}
          </div>
        )}
        <motion.section style={styles.hero} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <div>
            <p style={styles.kicker}>STUDENT SPACE</p>
            <h1 style={styles.title}>Student Dashboard</h1>
            <p style={styles.subtitle}>Track progress, readiness, and placement momentum from one command center</p>
          </div>
          <div style={styles.heroBadgeWrap}>
            <span style={styles.heroBadge}>{isReady ? "Placement Ready" : "Needs Improvement"}</span>
            <span style={styles.heroSubBadge}>{student.department || "Department"}</span>
          </div>
        </motion.section>

        <section style={styles.cards}>
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              style={{
                ...styles.card,
                ...(card.tone === "blue" ? styles.cardBlue : {}),
                ...(card.tone === "green" ? styles.cardGreen : {}),
                ...(card.tone === "cyan" ? styles.cardCyan : {}),
                ...(card.tone === "rose" ? styles.cardRose : {}),
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -3 }}
            >
              <p style={styles.cardTitle}>{card.title}</p>
              <h3 style={styles.cardValue}>{card.value}</h3>
              <p style={styles.cardNote}>{card.note}</p>
            </motion.div>
          ))}
        </section>

        <section style={styles.contentGrid}>
          <motion.article style={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}>CGPA Trend</h3>
              <span style={styles.panelPill}>Consistent Growth</span>
            </div>
            <ResponsiveContainer width="100%" height={290}>
              <AreaChart data={semesterData}>
                <defs>
                  <linearGradient id="cgpaArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="sem" stroke="#9fb4d4" tickLine={false} axisLine={false} />
                <YAxis stroke="#9fb4d4" tickLine={false} axisLine={false} domain={[6.5, 9.5]} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#67e8f9", strokeOpacity: 0.45 }} />
                <Area
                  type="monotone"
                  dataKey="cgpa"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  fill="url(#cgpaArea)"
                  dot={{ r: 4, fill: "#67e8f9", stroke: "#0c4a6e", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#67e8f9", stroke: "#e0f2fe", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            {!semesterData.length && <p style={styles.emptyNote}>No semester trend data available.</p>}
          </motion.article>

          <motion.article style={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div style={styles.profileHead}>
              <div style={styles.avatar}>{(student.name || "S").slice(0, 2).toUpperCase()}</div>
              <div>
                <p style={styles.profileName}>{student.name}</p>
                <p style={styles.profileMeta}>{student.regNo} | {student.department}</p>
              </div>
            </div>

            {!!loadError && <p style={styles.loadError}>{loadError}</p>}
            {!!saveMessage && (
              <p style={saveMessage.toLowerCase().includes("success") ? styles.saveOk : styles.loadError}>
                {saveMessage}
              </p>
            )}

            <div style={styles.profileStats}>
              <div style={styles.statTile}>
                <p style={styles.statTileLabel}>Attendance</p>
                <p style={styles.statTileValue}>{student.attendance}%</p>
              </div>
              <div style={styles.statTile}>
                <p style={styles.statTileLabel}>Placement Ready</p>
                <p style={styles.statTileValue}>{isReady ? "Yes" : "No"}</p>
              </div>
            </div>

            <div style={styles.feedWrap}>
              <p style={styles.feedTitle}>Recent Activity</p>
              {activityFeed.map((item, index) => (
                <p key={`${item}-${index}`} style={styles.feedItem}>{item}</p>
              ))}
              {!activityFeed.length && <p style={styles.emptyNote}>No recent activities available.</p>}
            </div>

            {canEdit && (
              <div style={styles.editWrap}>
                <div style={styles.editHeader}>
                  <p style={styles.feedTitle}>Edit Student Details</p>
                  {!isEditing ? (
                    <button type="button" style={styles.editButton} onClick={() => setIsEditing(true)}>
                      Edit
                    </button>
                  ) : (
                    <div style={styles.editActions}>
                      <button type="button" style={styles.editButton} onClick={saveStudentDetails}>
                        Save
                      </button>
                      <button type="button" style={styles.cancelButton} onClick={() => setIsEditing(false)}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <div style={styles.editGrid}>
                  <label style={styles.editLabel}>
                    Name
                    <input
                      style={styles.editInput}
                      value={editDraft.name}
                      disabled={!isEditing}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </label>
                  <label style={styles.editLabel}>
                    Department
                    <input
                      style={styles.editInput}
                      value={editDraft.department}
                      disabled={!isEditing}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, department: event.target.value }))}
                    />
                  </label>
                  <label style={styles.editLabel}>
                    CGPA
                    <input
                      style={styles.editInput}
                      value={editDraft.cgpa}
                      disabled={!isEditing}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, cgpa: event.target.value }))}
                    />
                  </label>
                  <label style={styles.editLabel}>
                    Attendance %
                    <input
                      style={styles.editInput}
                      value={editDraft.attendance}
                      disabled={!isEditing}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, attendance: event.target.value }))}
                    />
                  </label>
                  <label style={styles.editLabel}>
                    Activity Points
                    <input
                      style={styles.editInput}
                      value={editDraft.activityPoints}
                      disabled={!isEditing}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, activityPoints: event.target.value }))}
                    />
                  </label>
                  <label style={styles.editLabel}>
                    Arrears
                    <input
                      style={styles.editInput}
                      value={editDraft.arrears}
                      disabled={!isEditing}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, arrears: event.target.value }))}
                    />
                  </label>
                </div>
              </div>
            )}
          </motion.article>
        </section>

        <motion.section style={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Placement Readiness</h3>
            <span style={styles.panelPill}>Skill Snapshot</span>
          </div>

          <div style={styles.skillsWrap}>
            {skillData.map((item) => (
              <div key={item.name} style={styles.skillRow}>
                <div style={styles.skillTextRow}>
                  <span style={styles.skillName}>{item.name}</span>
                  <span style={styles.skillValue}>{item.score}%</span>
                </div>
                <div style={styles.skillTrack}>
                  <motion.div
                    style={{ ...styles.skillFill, width: `${item.score}%` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.score}%` }}
                    transition={{ duration: 0.65 }}
                  />
                </div>
              </div>
            ))}
            {!skillData.length && <p style={styles.emptyNote}>No skill data available.</p>}
          </div>
        </motion.section>
      </main>
    </motion.div>
  );
}

const styles = {
  page: {
    display: "flex",
    minHeight: "100vh",
    color: "#e2e8f0",
    fontFamily: "Space Grotesk, Inter, sans-serif",
    background: "linear-gradient(145deg, #020617 0%, #03153a 48%, #052f43 100%)",
    position: "relative",
    overflow: "hidden",
  },
  bgOrbOne: {
    position: "absolute",
    width: "520px",
    height: "520px",
    borderRadius: "999px",
    background: "radial-gradient(circle, rgba(56,189,248,0.2), rgba(56,189,248,0))",
    top: "-170px",
    right: "60px",
    pointerEvents: "none",
  },
  bgOrbTwo: {
    position: "absolute",
    width: "420px",
    height: "420px",
    borderRadius: "999px",
    background: "radial-gradient(circle, rgba(16,185,129,0.18), rgba(16,185,129,0))",
    bottom: "-180px",
    left: "220px",
    pointerEvents: "none",
  },
  bgGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
    backgroundSize: "44px 44px",
    maskImage: "radial-gradient(circle at center, black 35%, transparent 100%)",
    pointerEvents: "none",
  },
  sidebar: {
    width: "88px",
    padding: "16px 12px",
    background: "rgba(2,6,23,0.82)",
    backdropFilter: "blur(12px)",
    borderRight: "1px solid rgba(148,163,184,0.16)",
    boxShadow: "10px 0 26px rgba(0,0,0,0.35)",
    zIndex: 3,
    position: "relative",
  },
  logo: {
    marginBottom: "12px",
    fontSize: "22px",
    width: "64px",
    height: "44px",
    display: "grid",
    placeItems: "center",
    borderRadius: "10px",
    background: "linear-gradient(145deg, rgba(14,116,144,0.34), rgba(14,116,144,0.14))",
    border: "1px solid rgba(103,232,249,0.35)",
  },
  menuToggle: {
    width: "64px",
    textAlign: "center",
    background: "rgba(15,23,42,0.8)",
    border: "1px solid rgba(103,232,249,0.35)",
    borderRadius: "10px",
    color: "#d5f6ff",
    fontSize: "15px",
    fontWeight: 700,
    padding: "8px 10px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  nav: {
    position: "absolute",
    top: "66px",
    left: "10px",
    width: "172px",
    background: "rgba(2,6,23,0.95)",
    border: "1px solid rgba(103,232,249,0.25)",
    borderRadius: "12px",
    padding: "10px",
    transition: "transform 0.24s ease, opacity 0.24s ease",
    boxShadow: "0 14px 28px rgba(0,0,0,0.35)",
  },
  navOpen: {
    transform: "translateX(0)",
    opacity: 1,
    pointerEvents: "auto",
  },
  navClosed: {
    transform: "translateX(-18px)",
    opacity: 0,
    pointerEvents: "none",
  },
  menuButton: {
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    background: "transparent",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "16px",
    fontWeight: 600,
    fontFamily: "inherit",
  },
  logoutButton: {
    color: "#ffffff",
    border: "1px solid rgba(251,113,133,0.45)",
    background: "rgba(244,63,94,0.16)",
  },
  main: {
    flex: 1,
    padding: "30px 32px 34px",
    zIndex: 2,
  },
  previewBanner: {
    marginBottom: "10px",
    display: "inline-block",
    fontSize: "12px",
    fontWeight: 700,
    color: "#93c5fd",
    background: "rgba(59,130,246,0.15)",
    border: "1px solid rgba(96,165,250,0.35)",
    borderRadius: "999px",
    padding: "6px 12px",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    padding: "2px 0 6px",
    marginBottom: "10px",
  },
  kicker: {
    margin: 0,
    color: "#86e8ff",
    letterSpacing: "0.08em",
    fontSize: "12px",
    fontWeight: 700,
  },
  title: {
    margin: "2px 0 4px 0",
    fontSize: "52px",
    lineHeight: 1,
    letterSpacing: "-0.03em",
    color: "#f8fafc",
    textShadow: "0 8px 24px rgba(2,132,199,0.2)",
  },
  subtitle: {
    margin: 0,
    color: "#a8bad6",
    fontSize: "15px",
  },
  heroBadgeWrap: {
    display: "grid",
    gap: "8px",
    marginTop: "4px",
  },
  heroBadge: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#dcfce7",
    border: "1px solid rgba(74,222,128,0.4)",
    background: "rgba(34,197,94,0.16)",
    borderRadius: "999px",
    padding: "7px 12px",
    textAlign: "center",
  },
  heroSubBadge: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#d8f5ff",
    border: "1px solid rgba(56,189,248,0.35)",
    background: "rgba(56,189,248,0.14)",
    borderRadius: "999px",
    padding: "7px 12px",
    textAlign: "center",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "14px",
    margin: "12px 0 16px",
  },
  card: {
    borderRadius: "15px",
    padding: "14px 16px",
    border: "1px solid rgba(148,163,184,0.28)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.95), rgba(15,23,42,0.62))",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
  },
  cardBlue: {
    border: "1px solid rgba(56,189,248,0.4)",
  },
  cardGreen: {
    border: "1px solid rgba(74,222,128,0.4)",
  },
  cardCyan: {
    border: "1px solid rgba(103,232,249,0.4)",
  },
  cardRose: {
    border: "1px solid rgba(251,113,133,0.4)",
  },
  cardTitle: {
    margin: 0,
    color: "#9db2cf",
    fontSize: "12px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  cardValue: {
    margin: "6px 0 2px",
    fontSize: "38px",
    lineHeight: 1.1,
    color: "#f8fafc",
  },
  cardNote: {
    margin: 0,
    color: "#8ca5c8",
    fontSize: "13px",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1.06fr 0.94fr",
    gap: "14px",
    marginBottom: "14px",
  },
  panel: {
    borderRadius: "18px",
    padding: "18px 20px",
    border: "1px solid rgba(125,211,252,0.18)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(15,23,42,0.65))",
    boxShadow: "0 14px 30px rgba(0,0,0,0.22)",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
  },
  panelTitle: {
    margin: 0,
    fontSize: "18px",
    lineHeight: 1.1,
    letterSpacing: "-0.01em",
    color: "#f1f5f9",
  },
  panelPill: {
    fontSize: "12px",
    color: "#67e8f9",
    border: "1px solid rgba(103,232,249,0.35)",
    background: "rgba(8,145,178,0.18)",
    borderRadius: "999px",
    padding: "5px 10px",
    fontWeight: 700,
  },
  tooltip: {
    background: "rgba(2,6,23,0.95)",
    border: "1px solid rgba(56,189,248,0.42)",
    borderRadius: "10px",
    padding: "9px 12px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
  },
  tooltipLabel: {
    margin: 0,
    color: "#93c5fd",
    fontSize: "12px",
  },
  tooltipValue: {
    margin: "4px 0 0 0",
    fontWeight: 700,
    color: "#e2e8f0",
    fontSize: "14px",
  },
  profileHead: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "14px",
  },
  avatar: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontWeight: 700,
    fontSize: "25px",
    color: "#fff",
    background: "linear-gradient(140deg, #22d3ee, #22c55e)",
  },
  profileName: {
    margin: 0,
    fontSize: "18px",
    lineHeight: 1.1,
    color: "#f8fafc",
    letterSpacing: "-0.01em",
  },
  profileMeta: {
    margin: "2px 0 0",
    color: "#9db2cf",
    fontSize: "13px",
  },
  loadError: {
    color: "#fca5a5",
    fontSize: "13px",
    margin: "0 0 10px",
  },
  saveOk: {
    color: "#86efac",
    fontSize: "13px",
    margin: "0 0 10px",
  },
  profileStats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "12px",
  },
  statTile: {
    border: "1px solid rgba(96,165,250,0.28)",
    background: "rgba(15,32,64,0.42)",
    borderRadius: "12px",
    padding: "10px 12px",
  },
  statTileLabel: {
    margin: 0,
    color: "#9db2cf",
    fontSize: "12px",
  },
  statTileValue: {
    margin: "4px 0 0",
    fontSize: "20px",
    color: "#f8fafc",
    lineHeight: 1.1,
    fontWeight: 700,
  },
  feedWrap: {
    borderTop: "1px solid rgba(148,163,184,0.18)",
    paddingTop: "10px",
  },
  feedTitle: {
    margin: "0 0 8px",
    color: "#a5b4fc",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontSize: "13px",
    fontWeight: 700,
  },
  feedItem: {
    margin: "0 0 6px",
    color: "#e2e8f0",
    fontSize: "14px",
    lineHeight: 1.35,
  },
  editWrap: {
    borderTop: "1px solid rgba(148,163,184,0.18)",
    marginTop: "12px",
    paddingTop: "10px",
  },
  editHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  editActions: {
    display: "flex",
    gap: "8px",
  },
  editButton: {
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(56,189,248,0.35)",
    background: "rgba(14,165,233,0.2)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "12px",
  },
  cancelButton: {
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(251,113,133,0.45)",
    background: "rgba(244,63,94,0.16)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "12px",
  },
  editGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  editLabel: {
    display: "grid",
    gap: "5px",
    color: "#9db2cf",
    fontSize: "12px",
  },
  editInput: {
    border: "1px solid rgba(125,211,252,0.3)",
    borderRadius: "8px",
    padding: "8px 10px",
    background: "rgba(2,6,23,0.6)",
    color: "#fff",
    fontFamily: "inherit",
    fontSize: "13px",
  },
  skillsWrap: {
    display: "grid",
    gap: "12px",
    marginTop: "2px",
  },
  skillRow: {
    display: "grid",
    gap: "6px",
  },
  skillTextRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skillName: {
    color: "#d5e2f2",
    fontSize: "14px",
  },
  skillValue: {
    color: "#67e8f9",
    fontWeight: 700,
    fontSize: "14px",
    fontVariantNumeric: "tabular-nums",
  },
  skillTrack: {
    width: "100%",
    height: "10px",
    borderRadius: "999px",
    background: "rgba(30,41,59,0.85)",
    overflow: "hidden",
  },
  skillFill: {
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #38bdf8, #22c55e)",
  },
  emptyNote: {
    margin: "4px 0 0 0",
    color: "#9db2cf",
    fontSize: "13px",
  },
};
