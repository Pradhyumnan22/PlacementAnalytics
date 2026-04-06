import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { apiUrl, toUserErrorMessage } from "../utils/api";
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

const STATUS_STAGES = ["Not Ready", "Training", "Eligible", "Applied", "Interview", "Placed"];
const formatStudyYear = (value) => {
  const year = Number(value);
  if (!Number.isFinite(year) || year < 1 || year > 4) return "N/A";
  return `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} Year`;
};

const normalizeStatus = (status) => {
  const match = STATUS_STAGES.find((stage) => stage.toLowerCase() === String(status || "").toLowerCase().trim());
  return match || "Not Ready";
};

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
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [studentsData, setStudentsData] = useState([]);
  const [placementTrend, setPlacementTrend] = useState([]);
  const [companyStats, setCompanyStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionStatus, setActionStatus] = useState("");
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
        const studentsResponse = await fetch(apiUrl("/api/students"), {
          headers: { authorization: token },
        });
        if (!studentsResponse.ok) {
          throw new Error("Unable to fetch students");
        }
        const students = await studentsResponse.json();
        setStudentsData(students);

        const analyticsResponse = await fetch(apiUrl("/api/admin/analytics"), {
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
        setError(toUserErrorMessage(err, "Unable to fetch dashboard data. Check backend server."));
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [navigate]);

  const departmentOptions = useMemo(() => {
    const departments = new Set(
      studentsData
        .map((student) => String(student.department || "").trim())
        .filter(Boolean)
    );
    return ["All", ...Array.from(departments).sort()];
  }, [studentsData]);

  const yearOptions = useMemo(() => {
    const years = new Set(
      studentsData
        .map((student) => Number(student.studyYear))
        .filter((year) => Number.isFinite(year) && year >= 1 && year <= 4)
    );
    return ["All", ...Array.from(years).sort((a, b) => a - b).map((year) => String(year))];
  }, [studentsData]);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    return studentsData.filter((student) => {
      const matchesSearch =
        !normalizedSearch ||
        String(student.name || "").toLowerCase().includes(normalizedSearch) ||
        String(student.regNo || "").toLowerCase().includes(normalizedSearch) ||
        normalizeStatus(student.status).toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === "All" || normalizeStatus(student.status) === statusFilter;
      const matchesDepartment = departmentFilter === "All" || String(student.department || "").trim() === departmentFilter;
      const matchesYear = yearFilter === "All" || String(student.studyYear || "") === yearFilter;

      return matchesSearch && matchesStatus && matchesDepartment && matchesYear;
    });
  }, [studentsData, search, statusFilter, departmentFilter, yearFilter]);

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

  const statusCounts = useMemo(() => {
    const counts = STATUS_STAGES.reduce((acc, stage) => ({ ...acc, [stage]: 0 }), {});
    studentsData.forEach((student) => {
      const stage = normalizeStatus(student.status);
      counts[stage] += 1;
    });
    return counts;
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

  const atRiskStudents = useMemo(() => {
    return studentsData
      .map((student) => {
        const reasons = [];
        if (Number(student.cgpa || 0) < 7) reasons.push("Low CGPA");
        if (Number(student.attendance || 0) < 75) reasons.push("Low Attendance");
        if (Number(student.arrears || 0) > 0) reasons.push("Has Arrears");
        return { ...student, reasons };
      })
      .filter((student) => student.reasons.length)
      .slice(0, 8);
  }, [studentsData]);

  const cohortComparison = useMemo(() => {
    const departmentMap = {};
    studentsData.forEach((student) => {
      const department = String(student.department || "Unknown").trim() || "Unknown";
      if (!departmentMap[department]) {
        departmentMap[department] = { department, total: 0, ready: 0, cgpaSum: 0 };
      }
      departmentMap[department].total += 1;
      departmentMap[department].cgpaSum += Number(student.cgpa || 0);
      if (Number(student.cgpa || 0) >= 7 && Number(student.attendance || 0) >= 75 && Number(student.arrears || 0) === 0) {
        departmentMap[department].ready += 1;
      }
    });

    return Object.values(departmentMap).map((item) => ({
      department: item.department,
      readyRate: item.total ? Math.round((item.ready / item.total) * 100) : 0,
      avgCgpa: item.total ? Number((item.cgpaSum / item.total).toFixed(2)) : 0,
    }));
  }, [studentsData]);

  const exportFilteredToCsv = () => {
    const headers = ["Name", "RegNo", "Department", "Year", "CGPA", "Attendance", "Arrears", "Status", "NotesCount"];
    const rows = filteredStudents.map((student) => [
      student.name,
      student.regNo,
      student.department,
      student.studyYear,
      student.cgpa,
      student.attendance,
      student.arrears,
      normalizeStatus(student.status),
      Array.isArray(student.mentorNotes) ? student.mentorNotes.length : 0,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((item) => `"${String(item ?? "").replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `faculty-students-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const addStudentNote = async (regNo) => {
    const note = window.prompt("Enter mentoring note (max 500 chars):");
    if (!note || !note.trim()) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      setActionStatus("Saving mentor note...");
      const response = await fetch(apiUrl(`/api/students/${encodeURIComponent(regNo)}/notes`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: token,
        },
        body: JSON.stringify({ text: note.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Failed to save note");
      setStudentsData((prev) => prev.map((item) => (item.regNo === regNo ? { ...item, mentorNotes: data.mentorNotes } : item)));
      setActionStatus(`Mentor note saved for ${regNo}`);
    } catch (noteError) {
      setActionStatus(toUserErrorMessage(noteError, "Unable to save note."));
    }
  };

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
        <img src="/rmk-logo.png" alt="RMK Engineering College logo" style={styles.logo} />
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
              <h1 style={styles.title}>Faculty Dashboard</h1>
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
            <div style={styles.filterRow}>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                style={styles.filterSelect}
              >
                <option value="All">All Status</option>
                {STATUS_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                style={styles.filterSelect}
              >
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department === "All" ? "All Departments" : department}
                  </option>
                ))}
              </select>
              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                style={styles.filterSelect}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year === "All" ? "All Years" : formatStudyYear(year)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                style={styles.clearButton}
                onClick={() => {
                  setSearch("");
                  setStatusFilter("All");
                  setDepartmentFilter("All");
                  setYearFilter("All");
                }}
              >
                Clear
              </button>
              <button
                type="button"
                style={styles.exportButton}
                onClick={exportFilteredToCsv}
              >
                Export CSV
              </button>
            </div>
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
        <div style={styles.statusGrid}>
          {STATUS_STAGES.map((stage) => (
            <div key={stage} style={styles.statusCard}>
              <p style={styles.statusCardLabel}>{stage}</p>
              <p style={styles.statusCardValue}>{statusCounts[stage] || 0}</p>
            </div>
          ))}
        </div>
        {!!actionStatus && <p style={styles.actionStatus}>{actionStatus}</p>}

        <div style={styles.grid}>
          <motion.div
            style={styles.card}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div style={styles.trendHeader}>
              <h3 style={styles.trendTitle}>At-Risk Students</h3>
              <span style={styles.tableCount}>{atRiskStudents.length} flagged</span>
            </div>
            <div style={styles.riskList}>
              {atRiskStudents.map((student) => (
                <div key={student.regNo} style={styles.riskItem}>
                  <div>
                    <p style={styles.riskName}>{student.name}</p>
                    <p style={styles.riskMeta}>{student.regNo}</p>
                  </div>
                  <span style={styles.riskReason}>{student.reasons.join(", ")}</span>
                </div>
              ))}
              {!atRiskStudents.length && <p style={styles.emptyText}>No at-risk students right now.</p>}
            </div>
          </motion.div>

          <motion.div
            style={styles.card}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <h3 style={styles.trendTitle}>Cohort Comparison</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={cohortComparison}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="department" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="readyRate" fill="#22c55e" name="Ready %" radius={[6, 6, 0, 0]} />
                <Bar dataKey="avgCgpa" fill="#60a5fa" name="Avg CGPA" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
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
                <th>Year</th>
                <th>Status</th>
                <th style={styles.numericHeader}>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="9">Loading students...</td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan="9">{error}</td>
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
                    <td>{formatStudyYear(s.studyYear)}</td>
                    <td><span style={styles.statusBadge}>{normalizeStatus(s.status)}</span></td>
                    <td style={styles.numericCell}>{Array.isArray(s.mentorNotes) ? s.mentorNotes.length : 0}</td>
                    <td>
                      <button
                        type="button"
                        style={styles.noteButton}
                        onClick={(event) => {
                          event.stopPropagation();
                          addStudentNote(s.regNo);
                        }}
                      >
                        Add Note
                      </button>
                    </td>
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
    width: "64px",
    height: "76px",
    borderRadius: "10px",
    border: "1px solid rgba(103,232,249,0.35)",
    background: "rgba(2,6,23,0.35)",
    objectFit: "contain",
    padding: "2px",
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
  filterRow: {
    marginTop: "10px",
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  filterSelect: {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid rgba(125,211,252,0.25)",
    background: "rgba(15,23,42,0.75)",
    color: "white",
    minWidth: "160px",
    fontSize: "13px",
    outline: "none",
  },
  clearButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.28)",
    background: "rgba(15,23,42,0.85)",
    color: "#e2e8f0",
    fontSize: "13px",
    fontWeight: 700,
    marginRight: 0,
  },
  exportButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(52,211,153,0.35)",
    background: "rgba(16,185,129,0.15)",
    color: "#d1fae5",
    fontSize: "13px",
    fontWeight: 700,
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
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
    gap: "10px",
    marginBottom: "18px",
  },
  statusCard: {
    borderRadius: "12px",
    padding: "10px 12px",
    border: "1px solid rgba(148,163,184,0.22)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.85), rgba(15,23,42,0.58))",
  },
  statusCardLabel: {
    margin: 0,
    fontSize: "12px",
    color: "#9db2cf",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  statusCardValue: {
    margin: "6px 0 0 0",
    fontSize: "24px",
    fontWeight: 700,
    color: "#f8fafc",
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
    height: "420px",
    overflow: "auto",
    borderRadius: "12px",
    border: "1px solid rgba(125,211,252,0.12)",
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
  statusBadge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#d8f5ff",
    border: "1px solid rgba(56,189,248,0.35)",
    background: "rgba(56,189,248,0.14)",
  },
  actionStatus: {
    margin: "0 0 14px 0",
    color: "#93c5fd",
    fontSize: "13px",
  },
  riskList: {
    display: "grid",
    gap: "8px",
  },
  riskItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(2,6,23,0.45)",
    borderRadius: "10px",
    padding: "8px 10px",
  },
  riskName: {
    margin: 0,
    color: "#f8fafc",
    fontSize: "14px",
    fontWeight: 700,
  },
  riskMeta: {
    margin: "2px 0 0 0",
    color: "#9db2cf",
    fontSize: "12px",
  },
  riskReason: {
    border: "1px solid rgba(244,63,94,0.4)",
    background: "rgba(244,63,94,0.15)",
    color: "#fecdd3",
    borderRadius: "999px",
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: 700,
  },
  noteButton: {
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(103,232,249,0.4)",
    background: "rgba(14,165,233,0.2)",
    color: "#fff",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 700,
  },
  emptyText: {
    margin: "4px 0 0 0",
    color: "#9db2cf",
    fontSize: "13px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "12px",
  },
};
