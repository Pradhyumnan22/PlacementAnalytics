import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  Area,
  CartesianGrid,
} from "recharts";

const DEFAULT_PLACEMENT_TREND = [
  { year: "2021", placed: 40 },
  { year: "2022", placed: 55 },
  { year: "2023", placed: 72 },
  { year: "2024", placed: 88 },
];

const DEFAULT_COMPANY_OFFERS = [
  { name: "TCS", offers: 25 },
  { name: "Infosys", offers: 18 },
  { name: "Wipro", offers: 12 },
  { name: "Zoho", offers: 9 },
];

const normalizePlacementTrend = (trend) => {
  if (!Array.isArray(trend)) return [];

  return trend
    .map((item) => {
      const year = item?.year ?? item?.label ?? item?.batch ?? "";
      const placedRaw = item?.placed ?? item?.count ?? item?.value ?? 0;
      const placed = Number(placedRaw);
      return {
        year: String(year).trim(),
        placed: Number.isFinite(placed) ? Math.max(0, placed) : 0,
      };
    })
    .filter((item) => item.year);
};

const normalizeCompanyOffers = (offers) => {
  if (!Array.isArray(offers)) return [];

  return offers
    .map((item) => {
      const name = item?.name ?? item?.company ?? item?.label ?? "";
      const offersRaw = item?.offers ?? item?.count ?? item?.value ?? 0;
      const value = Number(offersRaw);
      return {
        name: String(name).trim(),
        offers: Number.isFinite(value) ? Math.max(0, value) : 0,
      };
    })
    .filter((item) => item.name);
};

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div style={styles.trendTooltip}>
      <p style={styles.trendTooltipYear}>{label}</p>
      <p style={styles.trendTooltipValue}>{payload[0].value} students placed</p>
    </div>
  );
};

const OffersTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div style={styles.trendTooltip}>
      <p style={styles.trendTooltipYear}>{label}</p>
      <p style={styles.trendTooltipValue}>{payload[0].value} offers</p>
    </div>
  );
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [studentsData, setStudentsData] = useState([]);
  const [placementTrend, setPlacementTrend] = useState([]);
  const [companyStats, setCompanyStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const topRef = useRef(null);
  const analyticsRef = useRef(null);
  const studentsRef = useRef(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("role");
        if (!token || role !== "admin") {
          navigate("/");
          return;
        }

        setLoading(true);
        setError("");
        const studentsResponse = await fetch("http://localhost:5000/api/students", {
          headers: { authorization: token },
        });
        if (!studentsResponse.ok) {
          throw new Error("Unable to fetch students");
        }
        const students = await studentsResponse.json();
        setStudentsData(students);

        const analyticsResponse = await fetch("http://localhost:5000/api/admin/analytics", {
          headers: { authorization: token },
        });
        if (analyticsResponse.ok) {
          const analytics = await analyticsResponse.json();
          setPlacementTrend(analytics.placementTrend || []);
          setCompanyStats(analytics.companyOffers || []);
        } else {
          setPlacementTrend([]);
          setCompanyStats([]);
        }
      } catch (err) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [navigate]);

  const filteredStudents = studentsData.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.regNo.toLowerCase().includes(search.toLowerCase())
  );

  const formatCgpa = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "N/A";
    const clamped = Math.min(Math.max(parsed, 0), 10);
    return clamped.toFixed(2);
  };

  const formatAttendance = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "N/A";
    const clamped = Math.min(Math.max(parsed, 0), 100);
    return `${Math.round(clamped)}%`;
  };

  const dashboardStats = useMemo(() => {
    if (!studentsData.length) {
      return {
        totalStudents: 0,
        avgCgpa: "0.00",
        avgAttendance: "0%",
        readyRate: "0%",
      };
    }

    const totalStudents = studentsData.length;
    const avgCgpa = (
      studentsData.reduce((sum, student) => sum + (student.cgpa || 0), 0) / totalStudents
    ).toFixed(2);
    const avgAttendance = `${Math.round(
      studentsData.reduce((sum, student) => sum + (student.attendance || 0), 0) / totalStudents
    )}%`;
    const readyStudents = studentsData.filter(
      (student) => (student.cgpa || 0) >= 7 && (student.attendance || 0) >= 75 && (student.arrears || 0) === 0
    ).length;
    const readyRate = `${Math.round((readyStudents / totalStudents) * 100)}%`;

    return { totalStudents, avgCgpa, avgAttendance, readyRate };
  }, [studentsData]);

  const trendData = useMemo(() => {
    const normalized = normalizePlacementTrend(placementTrend);
    return normalized.length ? normalized : DEFAULT_PLACEMENT_TREND;
  }, [placementTrend]);

  const companyOffersData = useMemo(() => {
    const normalized = normalizeCompanyOffers(companyStats);
    return normalized.length ? normalized : DEFAULT_COMPANY_OFFERS;
  }, [companyStats]);

  const trendDeltaLabel = useMemo(() => {
    if (trendData.length < 2) return "+0";
    const start = Number(trendData[0]?.placed || 0);
    const end = Number(trendData[trendData.length - 1]?.placed || 0);
    const diff = end - start;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${diff}`;
  }, [trendData]);

  const statCards = [
    { label: "Total Students", value: dashboardStats.totalStudents, tone: "blue", note: "Active records" },
    { label: "Average CGPA", value: dashboardStats.avgCgpa, tone: "cyan", note: "Academic index" },
    { label: "Average Attendance", value: dashboardStats.avgAttendance, tone: "green", note: "Overall presence" },
    { label: "Placement Ready", value: dashboardStats.readyRate, tone: "teal", note: "Eligible profile rate" },
  ];

  const scrollToSection = (sectionRef, sectionName) => {
    setActiveMenu(sectionName);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const menuItems = [
    {
      label: "Dashboard",
      action: () => {
        scrollToSection(topRef, "Dashboard");
        setShowSideMenu(false);
      },
    },
    {
      label: "Students",
      action: () => {
        scrollToSection(studentsRef, "Students");
        setShowSideMenu(false);
      },
    },
    {
      label: "Analytics",
      action: () => {
        scrollToSection(analyticsRef, "Analytics");
        setShowSideMenu(false);
      },
    },
    {
      label: "Logout",
      action: () => {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("loginId");
        navigate("/");
      },
    },
  ];

  return (
    <div style={styles.page} ref={topRef}>
      <div style={styles.bgOrbOne} />
      <div style={styles.bgOrbTwo} />
      <div style={styles.bgGrid} />
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <h2 style={styles.logo}>PA</h2>
        <button
          type="button"
          style={styles.menuToggle}
          onClick={() => setShowSideMenu((prev) => !prev)}
        >
          {showSideMenu ? "Close" : "Menu"}
        </button>
        <nav
          style={{
            ...styles.nav,
            ...(showSideMenu ? styles.navOpen : styles.navClosed),
          }}
        >
          {menuItems.map((item) => {
            const isActive = activeMenu === item.label;
            return (
              <motion.button
                key={item.label}
                type="button"
                onClick={item.action}
                style={{
                  ...styles.menuButton,
                  ...(isActive ? styles.menuButtonActive : {}),
                }}
                whileHover={{ x: 6, color: "#ffffff" }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
              >
                {item.label}
              </motion.button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        <motion.section
          style={styles.heroPanel}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div style={styles.titleRow}>
            <div>
              <p style={styles.kicker}>PLACEMENT COMMAND CENTER</p>
              <h1 style={styles.title}>Admin Dashboard</h1>
              <p style={styles.subtitle}>Placement insights, student readiness, and live records</p>
            </div>
            <div style={styles.livePillWrap}>
              <div style={styles.livePill}>Live Data</div>
              <div style={styles.securePill}>Secure Access</div>
            </div>
          </div>

          <div style={styles.searchWrap}>
            <input
              placeholder="Search students by name or register no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.search}
            />
          </div>
        </motion.section>

        <div style={styles.kpiGrid}>
          {statCards.map((card, index) => (
            <motion.div
              key={card.label}
              style={{
                ...styles.kpiCard,
                ...(card.tone === "blue" ? styles.kpiBlue : {}),
                ...(card.tone === "cyan" ? styles.kpiCyan : {}),
                ...(card.tone === "green" ? styles.kpiGreen : {}),
                ...(card.tone === "teal" ? styles.kpiTeal : {}),
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index, duration: 0.35 }}
              whileHover={{ y: -3 }}
            >
              <p style={styles.kpiLabel}>{card.label}</p>
              <p style={styles.kpiValue}>{card.value}</p>
              <p style={styles.kpiNote}>{card.note}</p>
            </motion.div>
          ))}
        </div>

        {/* Charts Section */}
        <div style={styles.grid} ref={analyticsRef}>
          {/* Placement Trend */}
          <motion.div
            style={styles.card}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            whileHover={{ y: -2 }}
          >
            <div style={styles.trendHeader}>
              <h3 style={styles.trendTitle}>Placement Trend</h3>
              <span style={styles.trendBadge}>{trendDeltaLabel} in {trendData.length} years</span>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData}>
                <defs>
                  <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="trendLineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2dd4bf" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: "#34d399", strokeOpacity: 0.45 }} />
                <Area
                  type="monotone"
                  dataKey="placed"
                  stroke="none"
                  fill="url(#trendAreaGradient)"
                  fillOpacity={1}
                />
                <Line
                  type="monotone"
                  dataKey="placed"
                  stroke="url(#trendLineGradient)"
                  strokeWidth={4}
                  dot={{ r: 5, fill: "#34d399", stroke: "#06222b", strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: "#34d399", stroke: "#dcfce7", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Company Stats */}
          <motion.div
            style={styles.card}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            whileHover={{ y: -2 }}
          >
            <h3 style={styles.trendTitle}>Company Offers</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={companyOffersData}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip content={<OffersTooltip />} cursor={{ fill: "rgba(59,130,246,0.15)" }} />
                <Bar dataKey="offers" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Students Table */}
        <motion.div
          style={styles.tableCard}
          ref={studentsRef}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <div style={styles.tableHeader}>
            <h3 style={styles.trendTitle}>Students</h3>
            <span style={styles.tableCount}>{filteredStudents.length} records</span>
          </div>
          <div style={styles.tableContainer}>
            <table className="dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Register No</th>
                <th style={styles.numericHeader}>CGPA</th>
                <th style={styles.numericHeader}>Attendance</th>
                <th style={styles.numericHeader}>Activity Points</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="5">Loading students...</td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan="5">{error}</td>
                </tr>
              )}
              {!loading &&
                !error &&
                filteredStudents.map((s, index) => (
                  <tr
                    key={s._id}
                    style={index % 2 ? { ...styles.rowAlt, ...styles.clickableRow } : styles.clickableRow}
                    onClick={() => navigate(`/student/${s.regNo}`)}
                    title={`Open ${s.name}'s dashboard`}
                  >
                    <td>{s.name}</td>
                    <td>{s.regNo}</td>
                    <td style={styles.numericCell}>{formatCgpa(s.cgpa)}</td>
                    <td style={styles.numericCell}>{formatAttendance(s.attendance)}</td>
                    <td style={styles.numericCell}>{s.activityPoints}</td>
                  </tr>
                ))}
            </tbody>
            </table>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    minHeight: "100vh",
    background: "linear-gradient(145deg,#020617 0%, #04163a 50%, #053047 100%)",
    color: "white",
    fontFamily: "Space Grotesk, Inter, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  bgGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
    backgroundSize: "44px 44px",
    maskImage: "radial-gradient(circle at center, black 38%, transparent 100%)",
    pointerEvents: "none",
  },
  bgOrbOne: {
    position: "absolute",
    width: "520px",
    height: "520px",
    borderRadius: "999px",
    background: "radial-gradient(circle, rgba(56,189,248,0.16), rgba(56,189,248,0))",
    top: "-170px",
    right: "40px",
    pointerEvents: "none",
  },
  bgOrbTwo: {
    position: "absolute",
    width: "420px",
    height: "420px",
    borderRadius: "999px",
    background: "radial-gradient(circle, rgba(16,185,129,0.15), rgba(16,185,129,0))",
    bottom: "-170px",
    left: "180px",
    pointerEvents: "none",
  },
  sidebar: {
    width: "88px",
    padding: "16px 12px",
    background: "rgba(2,6,23,0.82)",
    backdropFilter: "blur(12px)",
    borderRight: "1px solid rgba(255,255,255,0.05)",
    boxShadow: "10px 0 30px rgba(0,0,0,0.35)",
    position: "relative",
    overflow: "visible",
  },
  logo: {
    marginBottom: "14px",
    fontSize: "22px",
    width: "64px",
    height: "44px",
    display: "grid",
    placeItems: "center",
    borderRadius: "10px",
    background: "linear-gradient(145deg, rgba(14,116,144,0.34), rgba(14,116,144,0.14))",
    border: "1px solid rgba(103,232,249,0.35)",
  },
  nav: {
    position: "absolute",
    top: "66px",
    left: "10px",
    width: "170px",
    background: "rgba(2,6,23,0.96)",
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
  menuToggle: {
    width: "64px",
    textAlign: "center",
    background: "rgba(15,23,42,0.85)",
    border: "1px solid rgba(103,232,249,0.35)",
    borderRadius: "10px",
    color: "#e0f2fe",
    fontSize: "15px",
    fontWeight: 600,
    padding: "8px 10px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  menuButton: {
    width: "100%",
    textAlign: "left",
    margin: 0,
    cursor: "pointer",
    color: "#9ca3af",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "16px",
    fontWeight: 500,
    fontFamily: "inherit",
  },
  menuButtonActive: {
    color: "#ffffff",
    background: "rgba(59,130,246,0.16)",
    border: "1px solid rgba(96,165,250,0.35)",
  },
  main: {
    flex: 1,
    padding: "32px",
    position: "relative",
    zIndex: 2,
  },
  heroPanel: {
    borderRadius: "20px",
    border: "1px solid rgba(103,232,249,0.2)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.78), rgba(15,23,42,0.52))",
    backdropFilter: "blur(12px)",
    boxShadow: "0 16px 34px rgba(0,0,0,0.25)",
    padding: "20px 20px 16px",
    marginBottom: "14px",
  },
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px",
  },
  kicker: {
    margin: 0,
    color: "#67e8f9",
    letterSpacing: "0.08em",
    fontSize: "12px",
    fontWeight: 700,
  },
  title: {
    margin: "6px 0 6px 0",
    fontSize: "52px",
    letterSpacing: "-0.02em",
    lineHeight: 1.05,
    fontWeight: 800,
  },
  subtitle: {
    color: "#9db2cf",
    fontSize: "15px",
    margin: 0,
  },
  livePillWrap: {
    display: "grid",
    gap: "8px",
  },
  livePill: {
    fontSize: "12px",
    color: "#67e8f9",
    background: "rgba(8,145,178,0.18)",
    border: "1px solid rgba(103,232,249,0.35)",
    borderRadius: "999px",
    padding: "6px 12px",
    fontWeight: 700,
    letterSpacing: "0.03em",
  },
  securePill: {
    fontSize: "12px",
    color: "#a7f3d0",
    background: "rgba(16,185,129,0.16)",
    border: "1px solid rgba(52,211,153,0.35)",
    borderRadius: "999px",
    padding: "6px 12px",
    fontWeight: 700,
    letterSpacing: "0.03em",
    textAlign: "center",
  },
  searchWrap: {
    marginBottom: "4px",
  },
  search: {
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid rgba(125,211,252,0.25)",
    background: "rgba(15,23,42,0.75)",
    color: "white",
    width: "420px",
    maxWidth: "100%",
    fontSize: "14px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
    gap: "14px",
    marginBottom: "18px",
  },
  kpiCard: {
    borderRadius: "14px",
    padding: "14px 16px",
    border: "1px solid rgba(148,163,184,0.22)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(15,23,42,0.55))",
    boxShadow: "0 12px 26px rgba(0,0,0,0.22)",
  },
  kpiBlue: {
    border: "1px solid rgba(96,165,250,0.35)",
  },
  kpiCyan: {
    border: "1px solid rgba(103,232,249,0.35)",
  },
  kpiGreen: {
    border: "1px solid rgba(74,222,128,0.35)",
  },
  kpiTeal: {
    border: "1px solid rgba(45,212,191,0.35)",
  },
  kpiLabel: {
    margin: 0,
    fontSize: "12px",
    color: "#9db2cf",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  kpiValue: {
    margin: "8px 0 0 0",
    fontSize: "26px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  kpiNote: {
    margin: "4px 0 0 0",
    fontSize: "12px",
    color: "#9db2cf",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
    gap: "20px",
    marginBottom: "24px",
  },
  card: {
    padding: "20px",
    borderRadius: "16px",
    background: "linear-gradient(180deg, rgba(15,23,42,0.85), rgba(15,23,42,0.58))",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(125,211,252,0.12)",
    boxShadow: "0 16px 32px rgba(0,0,0,0.24)",
  },
  trendHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  trendTitle: {
    margin: 0,
    fontSize: "18px",
    letterSpacing: "-0.01em",
  },
  trendBadge: {
    fontSize: "12px",
    color: "#10b981",
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(16,185,129,0.35)",
    borderRadius: "999px",
    padding: "4px 10px",
    fontWeight: 600,
  },
  trendTooltip: {
    background: "rgba(2, 6, 23, 0.95)",
    border: "1px solid rgba(45,212,191,0.5)",
    borderRadius: "10px",
    padding: "10px 12px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
  },
  trendTooltipYear: {
    margin: 0,
    color: "#93c5fd",
    fontSize: "12px",
    letterSpacing: "0.04em",
  },
  trendTooltipValue: {
    margin: "4px 0 0 0",
    color: "#dcfce7",
    fontWeight: 700,
    fontSize: "13px",
  },
  tableCard: {
    padding: "20px",
    borderRadius: "16px",
    background: "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(15,23,42,0.65))",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(125,211,252,0.12)",
    boxShadow: "0 16px 34px rgba(0,0,0,0.24)",
  },
  tableHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
  },
  tableCount: {
    fontSize: "12px",
    color: "#93c5fd",
    background: "rgba(59,130,246,0.14)",
    border: "1px solid rgba(96,165,250,0.35)",
    borderRadius: "999px",
    padding: "4px 10px",
    fontWeight: 600,
  },
  tableContainer: {
    maxHeight: "420px",
    overflowY: "auto",
    borderRadius: "12px",
  },
  rowAlt: {
    background: "rgba(15,32,64,0.3)",
  },
  clickableRow: {
    cursor: "pointer",
  },
  numericCell: {
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  numericHeader: {
    textAlign: "right",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "12px",
  },
};
