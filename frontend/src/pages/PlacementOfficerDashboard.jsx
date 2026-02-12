import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
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

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={styles.tooltip}>
      <p style={styles.tooltipLabel}>{label}</p>
      <p style={styles.tooltipValue}>{payload[0].value} students placed</p>
    </div>
  );
};

const OffersTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={styles.tooltip}>
      <p style={styles.tooltipLabel}>{label}</p>
      <p style={styles.tooltipValue}>{payload[0].value} offers</p>
    </div>
  );
};

export default function PlacementOfficerDashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [placementTrend, setPlacementTrend] = useState([]);
  const [companyOffers, setCompanyOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingRegNo, setEditingRegNo] = useState("");
  const [draft, setDraft] = useState({ cgpa: "", attendance: "", activityPoints: "", arrears: "" });
  const [saveStatus, setSaveStatus] = useState("");

  const fetchDashboardData = async () => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (!token || role !== "placement_officer") {
      navigate("/");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const studentsResponse = await fetch("http://localhost:5000/api/students", {
        headers: { authorization: token },
      });
      if (!studentsResponse.ok) throw new Error("Unable to fetch students");
      const studentsData = await studentsResponse.json();
      setStudents(studentsData);

      const analyticsResponse = await fetch("http://localhost:5000/api/admin/analytics", {
        headers: { authorization: token },
      });
      if (analyticsResponse.ok) {
        const analytics = await analyticsResponse.json();
        setPlacementTrend(analytics?.placementTrend || []);
        setCompanyOffers(analytics?.companyOffers || []);
      } else {
        setPlacementTrend([]);
        setCompanyOffers([]);
      }
    } catch (fetchError) {
      setError(fetchError.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const filteredStudents = useMemo(
    () =>
      students.filter(
        (student) =>
          student.name.toLowerCase().includes(search.toLowerCase()) ||
          student.regNo.toLowerCase().includes(search.toLowerCase())
      ),
    [students, search]
  );

  const stats = useMemo(() => {
    if (!students.length) {
      return { totalStudents: 0, avgCgpa: "0.00", avgAttendance: "0%", readyRate: "0%" };
    }
    const total = students.length;
    const avgCgpa = (
      students.reduce((sum, student) => sum + Number(student.cgpa || 0), 0) / total
    ).toFixed(2);
    const avgAttendance = `${Math.round(
      students.reduce((sum, student) => sum + Number(student.attendance || 0), 0) / total
    )}%`;
    const ready = students.filter(
      (student) =>
        Number(student.cgpa || 0) >= 7 &&
        Number(student.attendance || 0) >= 75 &&
        Number(student.arrears || 0) === 0
    ).length;

    return {
      totalStudents: total,
      avgCgpa,
      avgAttendance,
      readyRate: `${Math.round((ready / total) * 100)}%`,
    };
  }, [students]);

  const formatCgpa = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "N/A";
    return Math.min(Math.max(parsed, 0), 10).toFixed(2);
  };

  const formatPercent = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "N/A";
    return `${Math.round(Math.min(Math.max(parsed, 0), 100))}%`;
  };

  const openEdit = (student) => {
    setEditingRegNo(student.regNo);
    setDraft({
      cgpa: String(student.cgpa ?? ""),
      attendance: String(student.attendance ?? ""),
      activityPoints: String(student.activityPoints ?? ""),
      arrears: String(student.arrears ?? ""),
    });
    setSaveStatus("");
  };

  const cancelEdit = () => {
    setEditingRegNo("");
    setDraft({ cgpa: "", attendance: "", activityPoints: "", arrears: "" });
    setSaveStatus("");
  };

  const saveEdit = async (regNo) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setSaveStatus("Saving...");
      const payload = {
        cgpa: Number(draft.cgpa),
        attendance: Number(draft.attendance),
        activityPoints: Number(draft.activityPoints),
        arrears: Number(draft.arrears),
      };

      const response = await fetch(`http://localhost:5000/api/students/${encodeURIComponent(regNo)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          authorization: token,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Failed to update student");

      setStudents((prev) => prev.map((item) => (item.regNo === regNo ? data : item)));
      setSaveStatus("Saved successfully");
      setEditingRegNo("");
    } catch (saveError) {
      setSaveStatus(saveError.message || "Update failed");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("loginId");
    navigate("/");
  };

  return (
    <div style={styles.page}>
      <main style={styles.main}>
        <section style={styles.header}>
          <div>
            <p style={styles.kicker}>PLACEMENT OFFICER CONSOLE</p>
            <h1 style={styles.title}>Officer Dashboard</h1>
            <p style={styles.subtitle}>Review and update student readiness metrics in one place.</p>
          </div>
          <button type="button" style={styles.logoutButton} onClick={logout}>
            Logout
          </button>
        </section>

        <section style={styles.cards}>
          <div style={styles.card}>
            <p style={styles.cardTitle}>Total Students</p>
            <p style={styles.cardValue}>{stats.totalStudents}</p>
          </div>
          <div style={styles.card}>
            <p style={styles.cardTitle}>Average CGPA</p>
            <p style={styles.cardValue}>{stats.avgCgpa}</p>
          </div>
          <div style={styles.card}>
            <p style={styles.cardTitle}>Average Attendance</p>
            <p style={styles.cardValue}>{stats.avgAttendance}</p>
          </div>
          <div style={styles.card}>
            <p style={styles.cardTitle}>Placement Ready</p>
            <p style={styles.cardValue}>{stats.readyRate}</p>
          </div>
        </section>

        <section style={styles.chartGrid}>
          <motion.div style={styles.panel} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={styles.panelTitle}>Placement Trend</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={placementTrend.length ? placementTrend : DEFAULT_PLACEMENT_TREND}>
                <defs>
                  <linearGradient id="poTrendArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="year" stroke="#9db2cf" tickLine={false} axisLine={false} />
                <YAxis stroke="#9db2cf" tickLine={false} axisLine={false} />
                <Tooltip content={<TrendTooltip />} />
                <Area type="monotone" dataKey="placed" fill="url(#poTrendArea)" stroke="none" />
                <Line type="monotone" dataKey="placed" stroke="#34d399" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div style={styles.panel} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={styles.panelTitle}>Company Offers</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={companyOffers.length ? companyOffers : DEFAULT_COMPANY_OFFERS}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" stroke="#9db2cf" tickLine={false} axisLine={false} />
                <YAxis stroke="#9db2cf" tickLine={false} axisLine={false} />
                <Tooltip content={<OffersTooltip />} />
                <Bar dataKey="offers" fill="#60a5fa" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </section>

        <section style={styles.panel}>
          <div style={styles.tableTop}>
            <h3 style={styles.panelTitle}>Students (Editable)</h3>
            <input
              style={styles.search}
              placeholder="Search by name or reg no"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {!!error && <p style={styles.error}>{error}</p>}
          {!!saveStatus && <p style={styles.status}>{saveStatus}</p>}

          <div style={styles.tableWrap}>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Reg No</th>
                  <th style={styles.numericHeader}>CGPA</th>
                  <th style={styles.numericHeader}>Attendance</th>
                  <th style={styles.numericHeader}>Activity</th>
                  <th style={styles.numericHeader}>Arrears</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="7">Loading...</td>
                  </tr>
                )}
                {!loading &&
                  filteredStudents.map((student) => {
                    const isEditing = editingRegNo === student.regNo;
                    return (
                      <tr key={student._id || student.regNo}>
                        <td>{student.name}</td>
                        <td>{student.regNo}</td>
                        <td style={styles.numericCell}>
                          {isEditing ? (
                            <input
                              value={draft.cgpa}
                              onChange={(event) => setDraft((prev) => ({ ...prev, cgpa: event.target.value }))}
                              style={styles.inlineInput}
                            />
                          ) : (
                            formatCgpa(student.cgpa)
                          )}
                        </td>
                        <td style={styles.numericCell}>
                          {isEditing ? (
                            <input
                              value={draft.attendance}
                              onChange={(event) => setDraft((prev) => ({ ...prev, attendance: event.target.value }))}
                              style={styles.inlineInput}
                            />
                          ) : (
                            formatPercent(student.attendance)
                          )}
                        </td>
                        <td style={styles.numericCell}>
                          {isEditing ? (
                            <input
                              value={draft.activityPoints}
                              onChange={(event) =>
                                setDraft((prev) => ({ ...prev, activityPoints: event.target.value }))
                              }
                              style={styles.inlineInput}
                            />
                          ) : (
                            student.activityPoints
                          )}
                        </td>
                        <td style={styles.numericCell}>
                          {isEditing ? (
                            <input
                              value={draft.arrears}
                              onChange={(event) => setDraft((prev) => ({ ...prev, arrears: event.target.value }))}
                              style={styles.inlineInput}
                            />
                          ) : (
                            student.arrears
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <div style={styles.actions}>
                              <button type="button" style={styles.actionButton} onClick={() => saveEdit(student.regNo)}>
                                Save
                              </button>
                              <button type="button" style={styles.cancelButton} onClick={cancelEdit}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button type="button" style={styles.actionButton} onClick={() => openEdit(student)}>
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(145deg,#020617 0%, #04163a 50%, #053047 100%)",
    color: "#e2e8f0",
    fontFamily: "Space Grotesk, Inter, sans-serif",
  },
  main: {
    padding: "28px 30px 34px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
    marginBottom: "14px",
  },
  kicker: {
    margin: 0,
    fontSize: "12px",
    letterSpacing: "0.08em",
    color: "#67e8f9",
    fontWeight: 700,
  },
  title: {
    margin: "6px 0 4px 0",
    fontSize: "46px",
    lineHeight: 1.02,
    letterSpacing: "-0.02em",
    color: "#f8fafc",
  },
  subtitle: {
    margin: 0,
    color: "#9db2cf",
    fontSize: "15px",
  },
  logoutButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(251,113,133,0.4)",
    background: "rgba(244,63,94,0.15)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "12px",
    marginBottom: "14px",
  },
  card: {
    borderRadius: "14px",
    padding: "13px 15px",
    border: "1px solid rgba(148,163,184,0.25)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(15,23,42,0.6))",
  },
  cardTitle: {
    margin: 0,
    color: "#9db2cf",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  cardValue: {
    margin: "8px 0 0 0",
    fontSize: "28px",
    color: "#f8fafc",
  },
  chartGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
    gap: "14px",
    marginBottom: "14px",
  },
  panel: {
    borderRadius: "16px",
    padding: "16px 18px",
    border: "1px solid rgba(125,211,252,0.15)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(15,23,42,0.62))",
  },
  panelTitle: {
    margin: "0 0 8px 0",
    color: "#f8fafc",
    fontSize: "21px",
    letterSpacing: "-0.01em",
  },
  tableTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px",
  },
  search: {
    maxWidth: "300px",
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid rgba(125,211,252,0.25)",
    background: "rgba(2,6,23,0.65)",
    color: "#fff",
  },
  tableWrap: {
    overflowX: "auto",
  },
  numericHeader: {
    textAlign: "right",
  },
  numericCell: {
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  inlineInput: {
    width: "72px",
    padding: "6px 8px",
    borderRadius: "8px",
    border: "1px solid rgba(125,211,252,0.3)",
    background: "rgba(2,6,23,0.7)",
    color: "#fff",
    textAlign: "right",
  },
  actions: {
    display: "flex",
    gap: "6px",
  },
  actionButton: {
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(103,232,249,0.4)",
    background: "rgba(14,165,233,0.2)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  cancelButton: {
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(251,113,133,0.45)",
    background: "rgba(244,63,94,0.18)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  error: {
    color: "#fca5a5",
    margin: "0 0 8px 0",
  },
  status: {
    color: "#86efac",
    margin: "0 0 8px 0",
  },
  tooltip: {
    background: "rgba(2,6,23,0.95)",
    border: "1px solid rgba(56,189,248,0.4)",
    borderRadius: "10px",
    padding: "9px 12px",
  },
  tooltipLabel: {
    margin: 0,
    fontSize: "12px",
    color: "#93c5fd",
  },
  tooltipValue: {
    margin: "4px 0 0 0",
    fontSize: "13px",
    fontWeight: 700,
    color: "#e2e8f0",
  },
};
