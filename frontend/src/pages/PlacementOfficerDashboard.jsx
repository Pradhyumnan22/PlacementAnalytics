import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { apiUrl, toUserErrorMessage } from "../utils/api";
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

const STATUS_STAGES = ["Not Ready", "Training", "Eligible", "Applied", "Interview", "Placed"];
const INITIAL_EDIT_DRAFT = { cgpa: "", attendance: "", activityPoints: "", arrears: "", status: "Not Ready" };
const INITIAL_CREATE_DRAFT = {
  name: "",
  regNo: "",
  password: "",
  department: "",
  studyYear: "",
  cgpa: "",
  attendance: "",
  activityPoints: "",
  arrears: "",
  status: "Not Ready",
};
const formatStudyYear = (value) => {
  const year = Number(value);
  if (!Number.isFinite(year) || year < 1 || year > 4) return "N/A";
  return `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} Year`;
};

const normalizeStatus = (status) => {
  const match = STATUS_STAGES.find((stage) => stage.toLowerCase() === String(status || "").toLowerCase().trim());
  return match || "Not Ready";
};

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
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [students, setStudents] = useState([]);
  const [placementTrend, setPlacementTrend] = useState([]);
  const [companyOffers, setCompanyOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingRegNo, setEditingRegNo] = useState("");
  const [draft, setDraft] = useState(INITIAL_EDIT_DRAFT);
  const [createDraft, setCreateDraft] = useState(INITIAL_CREATE_DRAFT);
  const [saveStatus, setSaveStatus] = useState("");
  const [users, setUsers] = useState([]);
  const [drives, setDrives] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [dataQuality, setDataQuality] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [driveSummary, setDriveSummary] = useState([]);
  const [companyPipeline, setCompanyPipeline] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "admin" });
  const [newDrive, setNewDrive] = useState({
    company: "",
    title: "",
    deadline: "",
    minCgpa: "7",
    minAttendance: "75",
    maxArrears: "0",
    status: "open",
  });
  const [interviewDraft, setInterviewDraft] = useState({
    regNo: "",
    company: "",
    round: "",
    slotTime: "",
    mode: "Online",
    note: "",
  });
  const [announcementDraft, setAnnouncementDraft] = useState({
    title: "",
    message: "",
    roles: "student",
    departments: "",
    years: "",
    statuses: "",
    expiresAt: "",
  });

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
      const studentsResponse = await fetch(apiUrl("/api/students"), {
        headers: { authorization: token },
      });
      if (!studentsResponse.ok) throw new Error("Unable to fetch students");
      const studentsData = await studentsResponse.json();
      setStudents(studentsData);

      const analyticsResponse = await fetch(apiUrl("/api/admin/analytics"), {
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

      const [usersResponse, drivesResponse, logsResponse, qualityResponse, kpiResponse, driveSummaryResponse, pipelineResponse, alertsResponse, announcementsResponse] = await Promise.all([
        fetch(apiUrl("/api/admin/users"), { headers: { authorization: token } }),
        fetch(apiUrl("/api/drives"), { headers: { authorization: token } }),
        fetch(apiUrl("/api/admin/audit-logs"), { headers: { authorization: token } }),
        fetch(apiUrl("/api/admin/data-quality"), { headers: { authorization: token } }),
        fetch(apiUrl("/api/admin/kpis"), { headers: { authorization: token } }),
        fetch(apiUrl("/api/admin/drives/summary"), { headers: { authorization: token } }),
        fetch(apiUrl("/api/admin/company-pipeline"), { headers: { authorization: token } }),
        fetch(apiUrl("/api/admin/alerts"), { headers: { authorization: token } }),
        fetch(apiUrl("/api/announcements"), { headers: { authorization: token } }),
      ]);

      if (usersResponse.ok) setUsers(await usersResponse.json());
      if (drivesResponse.ok) setDrives(await drivesResponse.json());
      if (logsResponse.ok) setAuditLogs(await logsResponse.json());
      if (qualityResponse.ok) setDataQuality(await qualityResponse.json());
      if (kpiResponse.ok) setKpis(await kpiResponse.json());
      if (driveSummaryResponse.ok) setDriveSummary(await driveSummaryResponse.json());
      if (pipelineResponse.ok) setCompanyPipeline(await pipelineResponse.json());
      if (alertsResponse.ok) {
        const data = await alertsResponse.json();
        setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      }
      if (announcementsResponse.ok) setAnnouncements(await announcementsResponse.json());
    } catch (fetchError) {
      setError(toUserErrorMessage(fetchError, "Unable to fetch dashboard data. Check backend server."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const departmentOptions = useMemo(() => {
    const departments = new Set(
      students
        .map((student) => String(student.department || "").trim())
        .filter(Boolean)
    );
    return ["All", ...Array.from(departments).sort()];
  }, [students]);

  const yearOptions = useMemo(() => {
    const years = new Set(
      students
        .map((student) => Number(student.studyYear))
        .filter((year) => Number.isFinite(year) && year >= 1 && year <= 4)
    );
    return ["All", ...Array.from(years).sort((a, b) => a - b).map((year) => String(year))];
  }, [students]);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    return students.filter((student) => {
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
  }, [students, search, statusFilter, departmentFilter, yearFilter]);

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

  const statusCounts = useMemo(() => {
    const counts = STATUS_STAGES.reduce((acc, stage) => ({ ...acc, [stage]: 0 }), {});
    students.forEach((student) => {
      const stage = normalizeStatus(student.status);
      counts[stage] += 1;
    });
    return counts;
  }, [students]);

  const canCreateStudent =
    createDraft.name.trim() && createDraft.regNo.trim() && createDraft.password && createDraft.department.trim();

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

  const getNumericField = (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const openEdit = (student) => {
    setEditingRegNo(student.regNo);
    setDraft({
      cgpa: String(student.cgpa ?? ""),
      attendance: String(student.attendance ?? ""),
      activityPoints: String(student.activityPoints ?? ""),
      arrears: String(student.arrears ?? ""),
      status: normalizeStatus(student.status),
    });
    setSaveStatus("");
  };

  const cancelEdit = () => {
    setEditingRegNo("");
    setDraft(INITIAL_EDIT_DRAFT);
    setSaveStatus("");
  };

  const saveEdit = async (regNo) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setSaveStatus("Saving...");
      const payload = {
        cgpa: getNumericField(draft.cgpa),
        attendance: getNumericField(draft.attendance),
        activityPoints: getNumericField(draft.activityPoints),
        arrears: getNumericField(draft.arrears),
        status: normalizeStatus(draft.status),
      };

      const response = await fetch(apiUrl(`/api/students/${encodeURIComponent(regNo)}`), {
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
      setSaveStatus(toUserErrorMessage(saveError, "Update failed. Unable to reach server."));
    }
  };

  const handleCreateField = (field, value) => {
    setCreateDraft((prev) => ({ ...prev, [field]: value }));
  };

  const createStudent = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setSaveStatus("Creating student...");
      const payload = {
        name: createDraft.name.trim(),
        regNo: createDraft.regNo.trim().toUpperCase(),
        password: createDraft.password,
        department: createDraft.department.trim(),
        status: normalizeStatus(createDraft.status),
      };

      const cgpa = getNumericField(createDraft.cgpa);
      const attendance = getNumericField(createDraft.attendance);
      const activityPoints = getNumericField(createDraft.activityPoints);
      const arrears = getNumericField(createDraft.arrears);
      const studyYear = getNumericField(createDraft.studyYear);

      if (cgpa !== undefined) payload.cgpa = cgpa;
      if (attendance !== undefined) payload.attendance = attendance;
      if (activityPoints !== undefined) payload.activityPoints = activityPoints;
      if (arrears !== undefined) payload.arrears = arrears;
      if (studyYear !== undefined) payload.studyYear = studyYear;

      const response = await fetch(apiUrl("/api/students"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: token,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Failed to create student");

      setStudents((prev) => [data, ...prev]);
      setCreateDraft(INITIAL_CREATE_DRAFT);
      setSaveStatus(`Student ${data.regNo} created`);
    } catch (createError) {
      setSaveStatus(toUserErrorMessage(createError, "Create failed. Unable to reach server."));
    }
  };

  const deleteStudent = async (regNo) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const confirmed = window.confirm(`Delete student ${regNo}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      setSaveStatus(`Deleting ${regNo}...`);
      const response = await fetch(apiUrl(`/api/students/${encodeURIComponent(regNo)}`), {
        method: "DELETE",
        headers: { authorization: token },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Failed to delete student");

      setStudents((prev) => prev.filter((student) => student.regNo !== regNo));
      if (editingRegNo === regNo) {
        setEditingRegNo("");
        setDraft(INITIAL_EDIT_DRAFT);
      }
      setSaveStatus(`Student ${regNo} deleted`);
    } catch (deleteError) {
      setSaveStatus(toUserErrorMessage(deleteError, "Delete failed. Unable to reach server."));
    }
  };

  const createUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      setSaveStatus("Creating user...");
      const response = await fetch(apiUrl("/api/admin/users"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: token,
        },
        body: JSON.stringify(newUser),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Failed to create user");
      setUsers((prev) => [data, ...prev]);
      setNewUser({ username: "", password: "", role: "admin" });
      setSaveStatus(`User ${data.username} created`);
    } catch (createError) {
      setSaveStatus(toUserErrorMessage(createError, "Failed to create user."));
    }
  };

  const toggleUserStatus = async (user) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      setSaveStatus("Updating user status...");
      const response = await fetch(apiUrl(`/api/admin/users/${user._id}/status`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          authorization: token,
        },
        body: JSON.stringify({ active: !user.active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Failed to update user");
      setUsers((prev) => prev.map((item) => (item._id === user._id ? { ...item, active: data.active } : item)));
      setSaveStatus(`User ${user.username} ${data.active ? "activated" : "deactivated"}`);
    } catch (statusError) {
      setSaveStatus(toUserErrorMessage(statusError, "Failed to update user status."));
    }
  };

  const resetUserPassword = async (user) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const newPassword = window.prompt(`Enter new password for ${user.username}:`);
    if (!newPassword) return;
    try {
      setSaveStatus("Resetting password...");
      const response = await fetch(apiUrl(`/api/admin/users/${user._id}/reset-password`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          authorization: token,
        },
        body: JSON.stringify({ newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Failed to reset password");
      setSaveStatus(`Password reset for ${user.username}`);
    } catch (resetError) {
      setSaveStatus(toUserErrorMessage(resetError, "Password reset failed."));
    }
  };

  const createDrive = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      setSaveStatus("Creating drive...");
      const payload = {
        company: newDrive.company.trim(),
        title: newDrive.title.trim(),
        deadline: newDrive.deadline,
        status: newDrive.status,
        eligibility: {
          minCgpa: Number(newDrive.minCgpa),
          minAttendance: Number(newDrive.minAttendance),
          maxArrears: Number(newDrive.maxArrears),
        },
      };
      const response = await fetch(apiUrl("/api/drives"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: token,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Failed to create drive");
      setDrives((prev) => [data, ...prev]);
      setNewDrive({
        company: "",
        title: "",
        deadline: "",
        minCgpa: "7",
        minAttendance: "75",
        maxArrears: "0",
        status: "open",
      });
      setSaveStatus(`Drive created for ${data.company}`);
    } catch (driveError) {
      setSaveStatus(toUserErrorMessage(driveError, "Failed to create drive."));
    }
  };

  const toggleDriveStatus = async (drive) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const nextStatus = drive.status === "open" ? "closed" : "open";
      setSaveStatus("Updating drive status...");
      const response = await fetch(apiUrl(`/api/drives/${drive._id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          authorization: token,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Failed to update drive");
      setDrives((prev) => prev.map((item) => (item._id === drive._id ? data : item)));
      setSaveStatus(`Drive ${data.company} set to ${data.status}`);
    } catch (driveStatusError) {
      setSaveStatus(toUserErrorMessage(driveStatusError, "Failed to update drive status."));
    }
  };

  const scheduleInterview = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      setSaveStatus("Scheduling interview...");
      const response = await fetch(apiUrl(`/api/students/${encodeURIComponent(interviewDraft.regNo)}/interviews`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: token,
        },
        body: JSON.stringify({
          company: interviewDraft.company,
          round: interviewDraft.round,
          slotTime: interviewDraft.slotTime,
          mode: interviewDraft.mode,
          note: interviewDraft.note,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Failed to schedule interview");
      setInterviewDraft({
        regNo: "",
        company: "",
        round: "",
        slotTime: "",
        mode: "Online",
        note: "",
      });
      setSaveStatus("Interview scheduled.");
    } catch (scheduleError) {
      setSaveStatus(toUserErrorMessage(scheduleError, "Failed to schedule interview."));
    }
  };

  const exportStudentsCsv = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      setSaveStatus("Preparing export...");
      const response = await fetch(apiUrl("/api/admin/export/students"), {
        headers: { authorization: token },
      });
      if (!response.ok) throw new Error("Failed to export students");
      const csvText = await response.text();
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `students-export-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setSaveStatus("Export downloaded.");
    } catch (exportError) {
      setSaveStatus(toUserErrorMessage(exportError, "Failed to export students."));
    }
  };

  const downloadAdminCalendar = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      setSaveStatus("Preparing calendar export...");
      const response = await fetch(apiUrl("/api/admin/calendar.ics"), {
        headers: { authorization: token },
      });
      if (!response.ok) throw new Error("Failed to export calendar");
      const icsText = await response.text();
      const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `admin-calendar-${new Date().toISOString().slice(0, 10)}.ics`;
      link.click();
      URL.revokeObjectURL(url);
      setSaveStatus("Calendar downloaded.");
    } catch (calendarError) {
      setSaveStatus(toUserErrorMessage(calendarError, "Failed to export calendar."));
    }
  };

  const createAnnouncement = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      setSaveStatus("Publishing announcement...");
      const payload = {
        title: announcementDraft.title.trim(),
        message: announcementDraft.message.trim(),
        audience: {
          roles: announcementDraft.roles
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          departments: announcementDraft.departments
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          years: announcementDraft.years
            .split(",")
            .map((item) => Number(item.trim()))
            .filter((item) => Number.isFinite(item)),
          statuses: announcementDraft.statuses
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        },
        expiresAt: announcementDraft.expiresAt || null,
      };

      const response = await fetch(apiUrl("/api/admin/announcements"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: token,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Failed to publish announcement");
      setAnnouncements((prev) => [data, ...prev]);
      setAnnouncementDraft({
        title: "",
        message: "",
        roles: "student",
        departments: "",
        years: "",
        statuses: "",
        expiresAt: "",
      });
      setSaveStatus("Announcement published.");
    } catch (announcementError) {
      setSaveStatus(toUserErrorMessage(announcementError, "Failed to publish announcement."));
    }
  };

  const reviewResume = async (student) => {
    const versions = Array.isArray(student.resumeVersions) ? student.resumeVersions : [];
    if (!versions.length) {
      setSaveStatus(`No resume versions found for ${student.regNo}`);
      return;
    }
    const latest = versions[versions.length - 1];
    const feedbackStatus = window.prompt("Feedback status (Pending/Reviewed/Approved):", latest.feedbackStatus || "Reviewed");
    if (!feedbackStatus) return;
    const feedbackComment = window.prompt("Feedback comment:", latest.feedbackComment || "") || "";
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setSaveStatus("Saving resume feedback...");
      const response = await fetch(apiUrl(`/api/students/${encodeURIComponent(student.regNo)}/resume/${latest._id}/feedback`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          authorization: token,
        },
        body: JSON.stringify({ feedbackStatus, feedbackComment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Failed to save feedback");
      setStudents((prev) => prev.map((item) => (item.regNo === student.regNo ? { ...item, resumeVersions: data.resumeVersions } : item)));
      setSaveStatus(`Resume reviewed for ${student.regNo}`);
    } catch (feedbackError) {
      setSaveStatus(toUserErrorMessage(feedbackError, "Failed to save resume feedback."));
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
            <p style={styles.kicker}>ADMIN CONSOLE</p>
            <h1 style={styles.title}>Admin Dashboard</h1>
            <p style={styles.subtitle}>Review and update student readiness metrics in one place.</p>
          </div>
          <div style={styles.actions}>
            <button type="button" style={styles.actionButton} onClick={exportStudentsCsv}>
              Export CSV
            </button>
            <button type="button" style={styles.actionButton} onClick={downloadAdminCalendar}>
              Export Calendar
            </button>
            <button type="button" style={styles.logoutButton} onClick={logout}>
              Logout
            </button>
          </div>
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
        <section style={styles.statusGrid}>
          {STATUS_STAGES.map((stage) => (
            <div key={stage} style={styles.statusCard}>
              <p style={styles.statusCardLabel}>{stage}</p>
              <p style={styles.statusCardValue}>{statusCounts[stage] || 0}</p>
            </div>
          ))}
        </section>

        <section style={styles.chartGrid}>
          <motion.div style={styles.panel} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={styles.panelTitle}>Automation Alerts</h3>
            <div style={styles.compactList}>
              {alerts.slice(0, 8).map((alert, index) => (
                <div key={`${alert.message}-${index}`} style={styles.compactRow}>
                  <span>{alert.message}</span>
                  <span style={styles.statusBadge}>{alert.type}</span>
                </div>
              ))}
              {!alerts.length && <p style={styles.qualityItem}>No active alerts.</p>}
            </div>
          </motion.div>

          <motion.div style={styles.panel} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={styles.panelTitle}>Interview Scheduler</h3>
            <div style={styles.createGrid}>
              <input
                style={styles.createInput}
                placeholder="Student Reg No"
                value={interviewDraft.regNo}
                onChange={(event) => setInterviewDraft((prev) => ({ ...prev, regNo: event.target.value }))}
              />
              <input
                style={styles.createInput}
                placeholder="Company"
                value={interviewDraft.company}
                onChange={(event) => setInterviewDraft((prev) => ({ ...prev, company: event.target.value }))}
              />
              <input
                style={styles.createInput}
                placeholder="Round"
                value={interviewDraft.round}
                onChange={(event) => setInterviewDraft((prev) => ({ ...prev, round: event.target.value }))}
              />
              <input
                style={styles.createInput}
                type="datetime-local"
                value={interviewDraft.slotTime}
                onChange={(event) => setInterviewDraft((prev) => ({ ...prev, slotTime: event.target.value }))}
              />
              <input
                style={styles.createInput}
                placeholder="Mode"
                value={interviewDraft.mode}
                onChange={(event) => setInterviewDraft((prev) => ({ ...prev, mode: event.target.value }))}
              />
              <input
                style={styles.createInput}
                placeholder="Note"
                value={interviewDraft.note}
                onChange={(event) => setInterviewDraft((prev) => ({ ...prev, note: event.target.value }))}
              />
              <button type="button" style={styles.actionButton} onClick={scheduleInterview}>
                Schedule Interview
              </button>
            </div>
          </motion.div>
        </section>

        <section style={styles.chartGrid}>
          <motion.div style={styles.panel} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={styles.panelTitle}>Bulk Announcement Center</h3>
            <div style={styles.createGrid}>
              <input
                style={styles.createInput}
                placeholder="Title"
                value={announcementDraft.title}
                onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
              <input
                style={styles.createInput}
                placeholder="Message"
                value={announcementDraft.message}
                onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, message: event.target.value }))}
              />
              <input
                style={styles.createInput}
                placeholder="Roles (student,admin)"
                value={announcementDraft.roles}
                onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, roles: event.target.value }))}
              />
              <input
                style={styles.createInput}
                placeholder="Departments (optional)"
                value={announcementDraft.departments}
                onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, departments: event.target.value }))}
              />
              <input
                style={styles.createInput}
                placeholder="Years (e.g. 1,2,3)"
                value={announcementDraft.years}
                onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, years: event.target.value }))}
              />
              <input
                style={styles.createInput}
                placeholder="Statuses (optional)"
                value={announcementDraft.statuses}
                onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, statuses: event.target.value }))}
              />
              <input
                style={styles.createInput}
                type="date"
                value={announcementDraft.expiresAt}
                onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, expiresAt: event.target.value }))}
              />
              <button type="button" style={styles.actionButton} onClick={createAnnouncement}>
                Publish
              </button>
            </div>
          </motion.div>

          <motion.div style={styles.panel} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={styles.panelTitle}>Recent Announcements</h3>
            <div style={styles.compactList}>
              {announcements.slice(0, 8).map((announcement) => (
                <div key={announcement._id} style={styles.compactRow}>
                  <span>{announcement.title} - {announcement.message}</span>
                  <span style={styles.statusBadge}>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
              {!announcements.length && <p style={styles.qualityItem}>No announcements yet.</p>}
            </div>
          </motion.div>
        </section>

        <section style={styles.chartGrid}>
          <motion.div style={styles.panel} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={styles.panelTitle}>Drive Application Flow</h3>
            <div style={styles.compactList}>
              {driveSummary.slice(0, 10).map((drive) => (
                <div key={drive._id} style={styles.compactRow}>
                  <span>{drive.company} - {drive.title}</span>
                  <span style={styles.statusBadge}>Applied: {drive.applicants}</span>
                </div>
              ))}
              {!driveSummary.length && <p style={styles.qualityItem}>No drive stats yet.</p>}
            </div>
          </motion.div>

          <motion.div style={styles.panel} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={styles.panelTitle}>Company Pipeline</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={companyPipeline.length ? companyPipeline : []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="company" stroke="#9db2cf" tickLine={false} axisLine={false} />
                <YAxis stroke="#9db2cf" tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="applied" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                <Bar dataKey="interview" fill="#34d399" radius={[8, 8, 0, 0]} />
                <Bar dataKey="selected" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </section>

        <section style={styles.chartGrid}>
          <motion.div style={styles.panel} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={styles.panelTitle}>Global KPIs</h3>
            <div style={styles.kpiMiniGrid}>
              <div style={styles.kpiMiniCard}>
                <p style={styles.kpiMiniLabel}>Placement Rate</p>
                <p style={styles.kpiMiniValue}>{kpis?.placementRate ?? 0}%</p>
              </div>
              <div style={styles.kpiMiniCard}>
                <p style={styles.kpiMiniLabel}>Eligibility Rate</p>
                <p style={styles.kpiMiniValue}>{kpis?.eligibilityRate ?? 0}%</p>
              </div>
              <div style={styles.kpiMiniCard}>
                <p style={styles.kpiMiniLabel}>Open Drives</p>
                <p style={styles.kpiMiniValue}>{kpis?.openDrives ?? 0}</p>
              </div>
              <div style={styles.kpiMiniCard}>
                <p style={styles.kpiMiniLabel}>Closing In 7 Days</p>
                <p style={styles.kpiMiniValue}>{kpis?.drivesClosingSoon ?? 0}</p>
              </div>
            </div>
          </motion.div>

          <motion.div style={styles.panel} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={styles.panelTitle}>Data Quality Monitor</h3>
            <div style={styles.qualityGrid}>
              <p style={styles.qualityItem}>Quality Score: {dataQuality?.profileQualityScore ?? 0}%</p>
              <p style={styles.qualityItem}>Missing Profiles: {dataQuality?.studentsWithMissingFields ?? 0}</p>
              <p style={styles.qualityItem}>Invalid Metrics: {dataQuality?.invalidMetricRecords ?? 0}</p>
              <p style={styles.qualityItem}>Students Without Notes: {dataQuality?.studentsWithoutNotes ?? 0}</p>
              <p style={styles.qualityItem}>Duplicate RegNo: {(dataQuality?.duplicateRegNos || []).length}</p>
            </div>
          </motion.div>
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

        <section style={styles.chartGrid}>
          <motion.div style={styles.panel} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={styles.panelTitle}>User Management</h3>
            <div style={styles.createGrid}>
              <input
                style={styles.createInput}
                placeholder="Username"
                value={newUser.username}
                onChange={(event) => setNewUser((prev) => ({ ...prev, username: event.target.value }))}
              />
              <input
                style={styles.createInput}
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
              />
              <select
                style={styles.createSelect}
                value={newUser.role}
                onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value }))}
              >
                <option value="admin">Faculty</option>
                <option value="placement_officer">Admin</option>
              </select>
              <button type="button" style={styles.actionButton} onClick={createUser}>
                Create User
              </button>
            </div>
            <div style={styles.compactList}>
              {users.slice(0, 8).map((user) => (
                <div key={user._id} style={styles.compactRow}>
                  <span>{user.username} ({user.role})</span>
                  <div style={styles.actions}>
                    <button type="button" style={styles.actionButton} onClick={() => toggleUserStatus(user)}>
                      {user.active ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" style={styles.cancelButton} onClick={() => resetUserPassword(user)}>
                      Reset Password
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div style={styles.panel} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={styles.panelTitle}>Drive Management</h3>
            <div style={styles.createGrid}>
              <input
                style={styles.createInput}
                placeholder="Company"
                value={newDrive.company}
                onChange={(event) => setNewDrive((prev) => ({ ...prev, company: event.target.value }))}
              />
              <input
                style={styles.createInput}
                placeholder="Role / Title"
                value={newDrive.title}
                onChange={(event) => setNewDrive((prev) => ({ ...prev, title: event.target.value }))}
              />
              <input
                style={styles.createInput}
                type="date"
                value={newDrive.deadline}
                onChange={(event) => setNewDrive((prev) => ({ ...prev, deadline: event.target.value }))}
              />
              <input
                style={styles.createInput}
                placeholder="Min CGPA"
                value={newDrive.minCgpa}
                onChange={(event) => setNewDrive((prev) => ({ ...prev, minCgpa: event.target.value }))}
              />
              <input
                style={styles.createInput}
                placeholder="Min Attendance"
                value={newDrive.minAttendance}
                onChange={(event) => setNewDrive((prev) => ({ ...prev, minAttendance: event.target.value }))}
              />
              <input
                style={styles.createInput}
                placeholder="Max Arrears"
                value={newDrive.maxArrears}
                onChange={(event) => setNewDrive((prev) => ({ ...prev, maxArrears: event.target.value }))}
              />
              <button type="button" style={styles.actionButton} onClick={createDrive}>
                Create Drive
              </button>
            </div>
            <div style={styles.compactList}>
              {drives.slice(0, 8).map((drive) => (
                <div key={drive._id} style={styles.compactRow}>
                  <span>{drive.company} - {drive.title}</span>
                  <div style={styles.actions}>
                    <span style={styles.statusBadge}>{drive.status}</span>
                    <button type="button" style={styles.actionButton} onClick={() => toggleDriveStatus(drive)}>
                      Toggle Status
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section style={styles.panel}>
          <div style={styles.tableTop}>
            <h3 style={styles.panelTitle}>Audit Log</h3>
            <span style={styles.statusBadge}>{auditLogs.length} entries</span>
          </div>
          <div style={styles.tableWrap}>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.slice(0, 40).map((log) => (
                  <tr key={log._id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.action}</td>
                    <td>{log.actorRole}</td>
                    <td>{log.summary}</td>
                  </tr>
                ))}
                {!auditLogs.length && (
                  <tr>
                    <td colSpan="4">No audit activity yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.tableTop}>
            <h3 style={styles.panelTitle}>Students (Editable)</h3>
            <div style={styles.filterWrap}>
              <input
                style={styles.search}
                placeholder="Search by name or reg no"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
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
            </div>
          </div>

          {!!error && <p style={styles.error}>{error}</p>}
          {!!saveStatus && <p style={styles.status}>{saveStatus}</p>}

          <div style={styles.createPanel}>
            <h4 style={styles.createTitle}>Create Student</h4>
            <div style={styles.createGrid}>
              <input
                style={styles.createInput}
                placeholder="Name"
                value={createDraft.name}
                onChange={(event) => handleCreateField("name", event.target.value)}
              />
              <input
                style={styles.createInput}
                placeholder="Reg No"
                value={createDraft.regNo}
                onChange={(event) => handleCreateField("regNo", event.target.value)}
              />
              <input
                style={styles.createInput}
                placeholder="Password"
                type="password"
                value={createDraft.password}
                onChange={(event) => handleCreateField("password", event.target.value)}
              />
              <input
                style={styles.createInput}
                placeholder="Department"
                value={createDraft.department}
                onChange={(event) => handleCreateField("department", event.target.value)}
              />
              <input
                style={styles.createInput}
                placeholder="Study Year (1-4)"
                value={createDraft.studyYear}
                onChange={(event) => handleCreateField("studyYear", event.target.value)}
              />
              <input
                style={styles.createInput}
                placeholder="CGPA"
                value={createDraft.cgpa}
                onChange={(event) => handleCreateField("cgpa", event.target.value)}
              />
              <input
                style={styles.createInput}
                placeholder="Attendance"
                value={createDraft.attendance}
                onChange={(event) => handleCreateField("attendance", event.target.value)}
              />
              <input
                style={styles.createInput}
                placeholder="Activity Points"
                value={createDraft.activityPoints}
                onChange={(event) => handleCreateField("activityPoints", event.target.value)}
              />
              <input
                style={styles.createInput}
                placeholder="Arrears"
                value={createDraft.arrears}
                onChange={(event) => handleCreateField("arrears", event.target.value)}
              />
              <select
                style={styles.createSelect}
                value={createDraft.status}
                onChange={(event) => handleCreateField("status", event.target.value)}
              >
                {STATUS_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
              <button type="button" style={styles.actionButton} onClick={createStudent} disabled={!canCreateStudent}>
                Create
              </button>
            </div>
          </div>

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
                  <th>Year</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="9">Loading...</td>
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
                        <td>{formatStudyYear(student.studyYear)}</td>
                        <td>
                          {isEditing ? (
                            <select
                              value={draft.status}
                              onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value }))}
                              style={styles.inlineSelect}
                            >
                              {STATUS_STAGES.map((stage) => (
                                <option key={stage} value={stage}>
                                  {stage}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span style={styles.statusBadge}>{normalizeStatus(student.status)}</span>
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
                            <div style={styles.actions}>
                              <button type="button" style={styles.actionButton} onClick={() => openEdit(student)}>
                                Edit
                              </button>
                              <button type="button" style={styles.actionButton} onClick={() => reviewResume(student)}>
                                Resume
                              </button>
                              <button type="button" style={styles.cancelButton} onClick={() => deleteStudent(student.regNo)}>
                                Delete
                              </button>
                            </div>
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
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "10px",
    marginBottom: "14px",
  },
  statusCard: {
    borderRadius: "12px",
    padding: "10px 12px",
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(15,23,42,0.65)",
  },
  statusCardLabel: {
    margin: 0,
    fontSize: "12px",
    color: "#9db2cf",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  statusCardValue: {
    margin: "6px 0 0 0",
    fontSize: "24px",
    color: "#f8fafc",
    fontWeight: 700,
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
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "10px",
    marginBottom: "10px",
  },
  filterWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    width: "100%",
  },
  search: {
    maxWidth: "320px",
    width: "320px",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid rgba(125,211,252,0.25)",
    background: "rgba(2,6,23,0.65)",
    color: "#fff",
  },
  filterSelect: {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid rgba(125,211,252,0.25)",
    background: "rgba(2,6,23,0.65)",
    color: "#fff",
    minWidth: "150px",
  },
  clearButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.28)",
    background: "rgba(15,23,42,0.85)",
    color: "#e2e8f0",
    fontSize: "13px",
    fontWeight: 700,
  },
  tableWrap: {
    height: "420px",
    overflow: "auto",
    border: "1px solid rgba(125,211,252,0.12)",
    borderRadius: "12px",
  },
  createPanel: {
    border: "1px solid rgba(125,211,252,0.2)",
    borderRadius: "12px",
    padding: "10px",
    margin: "0 0 10px 0",
    background: "rgba(2,6,23,0.45)",
  },
  createTitle: {
    margin: "0 0 8px 0",
    color: "#c4e8ff",
    fontSize: "14px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  createGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "8px",
    alignItems: "center",
  },
  createInput: {
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(125,211,252,0.25)",
    background: "rgba(2,6,23,0.65)",
    color: "#fff",
  },
  createSelect: {
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(125,211,252,0.25)",
    background: "rgba(2,6,23,0.65)",
    color: "#fff",
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
  inlineSelect: {
    padding: "6px 8px",
    borderRadius: "8px",
    border: "1px solid rgba(125,211,252,0.3)",
    background: "rgba(2,6,23,0.7)",
    color: "#fff",
    minWidth: "120px",
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
  kpiMiniGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  kpiMiniCard: {
    border: "1px solid rgba(125,211,252,0.22)",
    borderRadius: "10px",
    background: "rgba(2,6,23,0.45)",
    padding: "8px 10px",
  },
  kpiMiniLabel: {
    margin: 0,
    fontSize: "11px",
    color: "#9db2cf",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  kpiMiniValue: {
    margin: "6px 0 0",
    fontSize: "20px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  qualityGrid: {
    display: "grid",
    gap: "8px",
  },
  qualityItem: {
    margin: 0,
    fontSize: "13px",
    color: "#d5e2f2",
  },
  compactList: {
    display: "grid",
    gap: "8px",
    marginTop: "10px",
  },
  compactRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: "10px",
    background: "rgba(2,6,23,0.45)",
    padding: "8px 10px",
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
