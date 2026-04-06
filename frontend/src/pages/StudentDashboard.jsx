import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { apiUrl, toUserErrorMessage } from "../utils/api";
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

const STATUS_STAGES = ["Not Ready", "Training", "Eligible", "Applied", "Interview", "Placed"];

const normalizeStatus = (status) => {
  const match = STATUS_STAGES.find((stage) => stage.toLowerCase() === String(status || "").toLowerCase().trim());
  return match || "Not Ready";
};

const formatStudyYear = (value) => {
  const year = Number(value);
  if (!Number.isFinite(year) || year < 1 || year > 4) return "N/A";
  return `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} Year`;
};

const defaultStudent = {
  name: "Sneha Kumar",
  regNo: "PA2400213",
  department: "Computer Science",
  studyYear: 1,
  cgpa: 8.56,
  attendance: 91,
  activityPoints: 80,
  arrears: 0,
  status: "Not Ready",
  semesterPerformance: [],
  skillScores: [],
  recentActivities: [],
  placementProgress: [],
  mockTests: [],
  interviews: [],
  resumeVersions: [],
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

const normalizePlacementProgress = (items) => {
  if (!Array.isArray(items) || !items.length) return [];

  return items
    .map((item) => {
      const company = String(item?.company || item?.name || "").trim();
      const roundsClearedRaw = Array.isArray(item?.roundsCleared)
        ? item.roundsCleared
        : Array.isArray(item?.selectedRounds)
          ? item.selectedRounds
          : [];
      const roundsCleared = roundsClearedRaw
        .map((round) => String(round || "").trim())
        .filter(Boolean);
      const outcome = String(item?.outcome || "").trim() || (item?.eliminationRound === "Selected" ? "Selected" : "Eliminated");
      const eliminationRound = String(item?.eliminationRound || (outcome === "Selected" ? "Selected" : "N/A")).trim();
      const eliminationReason = String(item?.eliminationReason || "").trim();

      return { company, roundsCleared, eliminationRound, eliminationReason, outcome };
    })
    .filter((item) => item.company);
};

const normalizeStudent = (raw) => {
  const safe = raw && typeof raw === "object" ? raw : {};
  const departmentCode = String(safe.department || "").toUpperCase();
  const normalized = {
    ...defaultStudent,
    ...safe,
    department: departmentMap[departmentCode] || safe.department || defaultStudent.department,
    status: normalizeStatus(safe.status),
  };

  normalized.semesterPerformance = normalizeSemesterData(safe.semesterPerformance, safe.cgpa);
  normalized.skillScores = normalizeSkillData(safe.skillScores, normalized);
  normalized.recentActivities = normalizeActivities(safe.recentActivities);
  normalized.placementProgress = normalizePlacementProgress(safe.placementProgress);
  normalized.studyYear = Number.isFinite(Number(safe.studyYear))
    ? Math.min(4, Math.max(1, Number(safe.studyYear)))
    : defaultStudent.studyYear;

  return normalized;
};

const fetchJson = async (url, token, options = {}) => {
  let response;
  try {
    response = await fetch(apiUrl(url), {
      ...options,
      headers: { authorization: token, ...(options.headers || {}) },
    });
  } catch (error) {
    throw new Error(toUserErrorMessage(error, "Unable to reach server. Check backend is running."));
  }
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
  const [insights, setInsights] = useState({
    checklist: [],
    readinessScore: 0,
    actionPlan: [],
    profileCompleteness: { score: 0, completed: 0, total: 0 },
    notifications: [],
    upcomingDrives: [],
  });
  const [drives, setDrives] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [mockDraft, setMockDraft] = useState({ type: "Aptitude", score: "", weakTopics: "" });
  const [resumeDraft, setResumeDraft] = useState({ label: "", url: "" });
  const [editDraft, setEditDraft] = useState({
    name: "",
    department: "",
    cgpa: "",
    attendance: "",
    activityPoints: "",
    arrears: "",
    status: "Not Ready",
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
        let insightsResponse = null;
        let drivesResponse = [];
        if (role === "student") {
          const [profileData, insightData, driveData, simulationData, announcementData] = await Promise.all([
            fetchJson("/api/student/me", token),
            fetchJson("/api/student/insights", token).catch(() => null),
            fetchJson("/api/drives", token).catch(() => []),
            fetchJson("/api/student/eligibility-simulator", token).catch(() => ({ simulations: [] })),
            fetchJson("/api/announcements", token).catch(() => []),
          ]);
          response = profileData;
          insightsResponse = insightData;
          drivesResponse = Array.isArray(driveData) ? driveData : [];
          setSimulations(Array.isArray(simulationData?.simulations) ? simulationData.simulations : []);
          setAnnouncements(Array.isArray(announcementData) ? announcementData : []);
          setIsAdminPreview(false);
        } else if ((role === "admin" || role === "placement_officer") && regNo) {
          try {
            response = await fetchJson(`/api/students/${encodeURIComponent(regNo)}`, token);
          } catch {
            const allStudents = await fetchJson("/api/students", token);
            const match = Array.isArray(allStudents)
              ? allStudents.find((item) => String(item?.regNo || "").toUpperCase() === String(regNo).toUpperCase())
              : null;
            if (!match) throw new Error("Student not found");
            response = match;
          }
          drivesResponse = await fetchJson("/api/drives", token).catch(() => []);
          setAnnouncements(await fetchJson("/api/announcements", token).catch(() => []));
          setIsAdminPreview(true);
        } else {
          navigate("/");
          return;
        }

        setStudent(normalizeStudent(response));
        if (insightsResponse && typeof insightsResponse === "object") {
          setInsights({
            checklist: Array.isArray(insightsResponse.checklist) ? insightsResponse.checklist : [],
            readinessScore: Number(insightsResponse.readinessScore) || 0,
            actionPlan: Array.isArray(insightsResponse.actionPlan) ? insightsResponse.actionPlan : [],
            profileCompleteness: insightsResponse.profileCompleteness || { score: 0, completed: 0, total: 0 },
            notifications: Array.isArray(insightsResponse.notifications) ? insightsResponse.notifications : [],
            upcomingDrives: Array.isArray(insightsResponse.upcomingDrives) ? insightsResponse.upcomingDrives : [],
          });
        }
        setDrives(Array.isArray(drivesResponse) ? drivesResponse : []);
        setLoadError("");
      } catch (error) {
        setLoadError(toUserErrorMessage(error, "Failed to load student profile. Check backend server."));
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
      status: normalizeStatus(student.status),
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
        status: normalizeStatus(editDraft.status),
      };

      const data = await fetchJson(
        `/api/students/${encodeURIComponent(regNo)}`,
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
      setSaveMessage(toUserErrorMessage(error, "Update failed. Check backend server."));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("loginId");
    navigate("/");
  };

  const downloadCalendarIcs = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const endpoint = viewerRole === "student" ? "/api/student/calendar.ics" : "/api/admin/calendar.ics";
      const response = await fetch(apiUrl(endpoint), { headers: { authorization: token } });
      if (!response.ok) throw new Error("Unable to download calendar");
      const icsText = await response.text();
      const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = viewerRole === "student" ? "student-calendar.ics" : "dashboard-calendar.ics";
      anchor.click();
      URL.revokeObjectURL(url);
      setSaveMessage("Calendar downloaded.");
    } catch (error) {
      setSaveMessage(toUserErrorMessage(error, "Failed to download calendar."));
    }
  };

  const applyToDrive = async (driveId, action = "apply") => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const endpoint = action === "withdraw" ? `/api/drives/${driveId}/withdraw` : `/api/drives/${driveId}/apply`;
      await fetchJson(endpoint, token, { method: "POST" });
      const updatedDrives = await fetchJson("/api/drives", token);
      setDrives(Array.isArray(updatedDrives) ? updatedDrives : []);
      setSaveMessage(action === "withdraw" ? "Application withdrawn." : "Applied successfully.");
    } catch (error) {
      setSaveMessage(toUserErrorMessage(error, "Unable to update application."));
    }
  };

  const submitMockTest = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const payload = {
        type: mockDraft.type,
        score: Number(mockDraft.score),
        weakTopics: mockDraft.weakTopics
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      const response = await fetchJson("/api/student/mock-tests", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setStudent((prev) => ({ ...prev, mockTests: response.mockTests || prev.mockTests || [] }));
      setMockDraft({ type: "Aptitude", score: "", weakTopics: "" });
      setSaveMessage("Mock test saved.");
    } catch (error) {
      setSaveMessage(toUserErrorMessage(error, "Unable to save mock test."));
    }
  };

  const uploadResumeVersion = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await fetchJson("/api/student/resume", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resumeDraft),
      });
      setStudent((prev) => ({ ...prev, resumeVersions: response.resumeVersions || prev.resumeVersions || [] }));
      setResumeDraft({ label: "", url: "" });
      setSaveMessage("Resume version uploaded.");
    } catch (error) {
      setSaveMessage(toUserErrorMessage(error, "Unable to upload resume."));
    }
  };

  const respondInterview = async (interviewId, status) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await fetchJson(`/api/student/interviews/${interviewId}/respond`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setStudent((prev) => ({ ...prev, interviews: response.interviews || prev.interviews || [] }));
      setSaveMessage(`Interview ${status.toLowerCase()}.`);
    } catch (error) {
      setSaveMessage(toUserErrorMessage(error, "Unable to update interview response."));
    }
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
  const placementProgress = student.placementProgress || [];
  const companiesAttended = placementProgress.length;
  const totalRoundsCleared = placementProgress.reduce((sum, item) => sum + (item.roundsCleared?.length || 0), 0);
  const roundWiseSelections = placementProgress.reduce((acc, item) => {
    (item.roundsCleared || []).forEach((round) => {
      acc[round] = (acc[round] || 0) + 1;
    });
    return acc;
  }, {});
  const fallbackChecklist = [
    { id: "cgpa", label: "Minimum CGPA 7.0", met: (student.cgpa || 0) >= 7, current: Number(student.cgpa || 0).toFixed(2) },
    { id: "attendance", label: "Attendance at least 75%", met: (student.attendance || 0) >= 75, current: `${Math.round(student.attendance || 0)}%` },
    { id: "arrears", label: "No active arrears", met: Number(student.arrears || 0) === 0, current: String(student.arrears || 0) },
    { id: "activity", label: "Activity points at least 60", met: (student.activityPoints || 0) >= 60, current: String(student.activityPoints || 0) },
  ];
  const eligibilityChecklist = insights.checklist?.length ? insights.checklist : fallbackChecklist;
  const actionPlanItems = insights.actionPlan?.length
    ? insights.actionPlan
    : ["Maintain your current progress and keep practicing aptitude and interviews."];
  const profileCompleteness = Number(insights.profileCompleteness?.score || 0);
  const readinessScore = Number(insights.readinessScore || Math.round(((student.cgpa || 0) / 10) * 100));
  const notifications = insights.notifications?.length
    ? insights.notifications
    : [{ type: "info", message: "No new notifications right now.", deadline: null }];
  const driveMap = Array.isArray(drives)
    ? drives.reduce((acc, drive) => {
      acc[String(drive._id || drive.id)] = drive;
      return acc;
    }, {})
    : {};
  const sourceDrives = insights.upcomingDrives?.length
    ? insights.upcomingDrives
    : Array.isArray(drives)
      ? drives.slice(0, 6)
      : [];
  const upcomingDrives = sourceDrives.map((drive) => {
    const id = String(drive.id || drive._id || `${drive.company}-${drive.title}`);
    const mapped = driveMap[id] || {};
    return {
      id,
      company: drive.company || mapped.company || "Company",
      title: drive.title || mapped.title || "Drive",
      deadline: drive.deadline || mapped.deadline,
      eligible: typeof drive.eligible === "boolean" ? drive.eligible : (typeof mapped.eligible === "boolean" ? mapped.eligible : null),
      reasons: Array.isArray(drive.reasons) ? drive.reasons : (Array.isArray(mapped.reasons) ? mapped.reasons : []),
      applicationStatus: drive.applicationStatus || mapped.applicationStatus || "not_applied",
    };
  });

  return (
    <motion.div style={styles.page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div style={styles.bgOrbOne} />
      <div style={styles.bgOrbTwo} />
      <div style={styles.bgGrid} />

      <aside style={styles.sidebar}>
        <img src="/rmk-logo.png" alt="RMK Engineering College logo" style={styles.logo} />
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
            onClick={downloadCalendarIcs}
            style={styles.menuButton}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            Calendar
          </motion.button>
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
            {viewerRole === "placement_officer" ? "Admin" : "Faculty"} preview mode for {student.name}
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
            <span style={styles.heroSubBadge}>Status: {normalizeStatus(student.status)}</span>
            <span style={styles.heroSubBadge}>{formatStudyYear(student.studyYear)}</span>
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

        <section style={styles.insightGrid}>
          <motion.article style={styles.panel} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}>Eligibility Checklist</h3>
              <span style={styles.panelPill}>Readiness {readinessScore}%</span>
            </div>
            <div style={styles.checklistWrap}>
              {eligibilityChecklist.map((item) => (
                <div key={item.id || item.label} style={styles.checklistRow}>
                  <span style={item.met ? styles.checkOk : styles.checkWarn}>{item.met ? "PASS" : "PENDING"}</span>
                  <span style={styles.checkLabel}>{item.label}</span>
                  <span style={styles.checkCurrent}>{item.current}</span>
                </div>
              ))}
            </div>
            <div style={styles.progressMeta}>
              <span style={styles.progressLabel}>Profile completeness</span>
              <span style={styles.progressValue}>{profileCompleteness}%</span>
            </div>
            <div style={styles.skillTrack}>
              <div style={{ ...styles.skillFill, width: `${Math.max(0, Math.min(100, profileCompleteness))}%` }} />
            </div>
          </motion.article>

          <motion.article style={styles.panel} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}>Action Plan</h3>
              <span style={styles.panelPill}>Next Steps</span>
            </div>
            <div style={styles.feedWrap}>
              {actionPlanItems.map((item, index) => (
                <p key={`${item}-${index}`} style={styles.feedItem}>• {item}</p>
              ))}
            </div>
            <div style={styles.feedWrap}>
              <p style={styles.feedTitle}>Notifications</p>
              {notifications.map((item, index) => (
                <p key={`${item.message}-${index}`} style={styles.feedItem}>
                  {item.message}
                  {item.deadline ? ` (Deadline: ${new Date(item.deadline).toLocaleDateString()})` : ""}
                </p>
              ))}
            </div>
          </motion.article>
        </section>

        <section style={styles.insightGrid}>
          <motion.article style={styles.panel} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}>Eligibility Simulator</h3>
              <span style={styles.panelPill}>Company Fit</span>
            </div>
            <div style={styles.timelineList}>
              {simulations.slice(0, 8).map((item) => (
                <div key={item.driveId} style={styles.timelineRow}>
                  <div>
                    <p style={styles.timelineCompany}>{item.company}</p>
                    <p style={styles.timelineRole}>{item.title}</p>
                  </div>
                  <div style={styles.timelineMeta}>
                    <span style={item.eligible ? styles.checkOk : styles.checkWarn}>{item.eligible ? "Eligible" : "Not Eligible"}</span>
                    {!item.eligible && (
                      <span style={styles.timelineRole}>{(item.reasons || []).slice(0, 2).join(", ")}</span>
                    )}
                  </div>
                </div>
              ))}
              {!simulations.length && <p style={styles.emptyNote}>No simulation data available.</p>}
            </div>
          </motion.article>

          <motion.article style={styles.panel} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}>Announcements</h3>
              <span style={styles.panelPill}>Broadcasts</span>
            </div>
            <div style={styles.timelineList}>
              {announcements.slice(0, 6).map((announcement) => (
                <div key={announcement._id} style={styles.timelineRow}>
                  <div>
                    <p style={styles.timelineCompany}>{announcement.title}</p>
                    <p style={styles.timelineRole}>{announcement.message}</p>
                  </div>
                  <div style={styles.timelineMeta}>
                    <span style={styles.timelineDate}>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {!announcements.length && <p style={styles.emptyNote}>No announcements right now.</p>}
            </div>
          </motion.article>
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
                <p style={styles.profileMeta}>{student.regNo} | {student.department} | {formatStudyYear(student.studyYear)}</p>
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
                  <label style={styles.editLabel}>
                    Status
                    <select
                      style={styles.editInput}
                      value={editDraft.status}
                      disabled={!isEditing}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, status: event.target.value }))}
                    >
                      {STATUS_STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
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

        <motion.section style={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Upcoming Drives Timeline</h3>
            <span style={styles.panelPill}>Deadlines</span>
          </div>
          <div style={styles.timelineList}>
            {upcomingDrives.map((drive) => (
              <div key={drive.id} style={styles.timelineRow}>
                <div>
                  <p style={styles.timelineCompany}>{drive.company}</p>
                  <p style={styles.timelineRole}>{drive.title}</p>
                </div>
                <div style={styles.timelineMeta}>
                  <span style={styles.timelineDate}>{drive.deadline ? new Date(drive.deadline).toLocaleDateString() : "TBA"}</span>
                  {typeof drive.eligible === "boolean" && (
                    <span style={drive.eligible ? styles.checkOk : styles.checkWarn}>
                      {drive.eligible ? "Eligible" : "Improve"}
                    </span>
                  )}
                  {viewerRole === "student" && (
                    <button
                      type="button"
                      style={styles.timelineAction}
                      onClick={() => applyToDrive(drive.id, drive.applicationStatus === "applied" ? "withdraw" : "apply")}
                      disabled={drive.eligible === false && drive.applicationStatus !== "applied"}
                    >
                      {drive.applicationStatus === "applied" ? "Withdraw" : "Apply"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!upcomingDrives.length && <p style={styles.emptyNote}>No active drives right now.</p>}
          </div>
        </motion.section>

        <section style={styles.insightGrid}>
          <motion.article style={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}>Mock Test Tracker</h3>
              <span style={styles.panelPill}>Practice Scores</span>
            </div>
            {viewerRole === "student" && (
              <div style={styles.mockForm}>
                <select
                  style={styles.editInput}
                  value={mockDraft.type}
                  onChange={(event) => setMockDraft((prev) => ({ ...prev, type: event.target.value }))}
                >
                  <option value="Aptitude">Aptitude</option>
                  <option value="Coding">Coding</option>
                  <option value="Verbal">Verbal</option>
                </select>
                <input
                  style={styles.editInput}
                  placeholder="Score (0-100)"
                  value={mockDraft.score}
                  onChange={(event) => setMockDraft((prev) => ({ ...prev, score: event.target.value }))}
                />
                <input
                  style={styles.editInput}
                  placeholder="Weak topics (comma separated)"
                  value={mockDraft.weakTopics}
                  onChange={(event) => setMockDraft((prev) => ({ ...prev, weakTopics: event.target.value }))}
                />
                <button type="button" style={styles.editButton} onClick={submitMockTest}>
                  Add Mock Test
                </button>
              </div>
            )}
            <div style={styles.timelineList}>
              {(student.mockTests || []).slice(-6).reverse().map((test, index) => (
                <div key={`${test.type}-${index}`} style={styles.timelineRow}>
                  <div>
                    <p style={styles.timelineCompany}>{test.type}</p>
                    <p style={styles.timelineRole}>
                      Weak areas: {Array.isArray(test.weakTopics) && test.weakTopics.length ? test.weakTopics.join(", ") : "None"}
                    </p>
                  </div>
                  <div style={styles.timelineMeta}>
                    <span style={styles.timelineDate}>{new Date(test.takenAt || Date.now()).toLocaleDateString()}</span>
                    <span style={styles.panelPill}>{Math.round(Number(test.score || 0))}%</span>
                  </div>
                </div>
              ))}
              {!student.mockTests?.length && <p style={styles.emptyNote}>No mock tests added yet.</p>}
            </div>
          </motion.article>

          <motion.article style={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}>Interview Scheduler</h3>
              <span style={styles.panelPill}>Upcoming Slots</span>
            </div>
            <div style={styles.timelineList}>
              {(student.interviews || []).slice(-8).reverse().map((interview, index) => (
                <div key={`${interview.company}-${interview.slotTime}-${index}`} style={styles.timelineRow}>
                  <div>
                    <p style={styles.timelineCompany}>{interview.company}</p>
                    <p style={styles.timelineRole}>{interview.round} | {interview.mode || "Online"}</p>
                  </div>
                  <div style={styles.timelineMeta}>
                    <span style={styles.timelineDate}>{new Date(interview.slotTime).toLocaleString()}</span>
                    <span style={styles.panelPill}>{interview.status}</span>
                    {viewerRole === "student" && interview.status === "Scheduled" && interview._id && (
                      <div style={styles.editActions}>
                        <button type="button" style={styles.editButton} onClick={() => respondInterview(interview._id, "Accepted")}>
                          Accept
                        </button>
                        <button type="button" style={styles.cancelButton} onClick={() => respondInterview(interview._id, "Declined")}>
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!student.interviews?.length && <p style={styles.emptyNote}>No interview slots scheduled.</p>}
            </div>
          </motion.article>
        </section>

        <motion.section style={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Resume Tracker</h3>
            <span style={styles.panelPill}>Version History</span>
          </div>
          {viewerRole === "student" && (
            <div style={styles.mockForm}>
              <input
                style={styles.editInput}
                placeholder="Version label (e.g. Resume v2)"
                value={resumeDraft.label}
                onChange={(event) => setResumeDraft((prev) => ({ ...prev, label: event.target.value }))}
              />
              <input
                style={styles.editInput}
                placeholder="Resume URL"
                value={resumeDraft.url}
                onChange={(event) => setResumeDraft((prev) => ({ ...prev, url: event.target.value }))}
              />
              <button type="button" style={styles.editButton} onClick={uploadResumeVersion}>
                Upload Version
              </button>
            </div>
          )}
          <div style={styles.timelineList}>
            {(student.resumeVersions || []).slice(-8).reverse().map((entry, index) => (
              <div key={`${entry.label}-${index}`} style={styles.timelineRow}>
                <div>
                  <p style={styles.timelineCompany}>{entry.label}</p>
                  <p style={styles.timelineRole}>{entry.feedbackComment || "Awaiting faculty review"}</p>
                </div>
                <div style={styles.timelineMeta}>
                  <a href={entry.url} target="_blank" rel="noreferrer" style={styles.resumeLink}>Open</a>
                  <span style={styles.panelPill}>{entry.feedbackStatus || "Pending"}</span>
                </div>
              </div>
            ))}
            {!student.resumeVersions?.length && <p style={styles.emptyNote}>No resume versions uploaded yet.</p>}
          </div>
        </motion.section>

        <motion.section style={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Company Rounds</h3>
            <span style={styles.panelPill}>Interview Journey</span>
          </div>

          <div style={styles.roundStats}>
            <div style={styles.roundStatCard}>
              <p style={styles.roundStatLabel}>Companies Attended</p>
              <p style={styles.roundStatValue}>{companiesAttended}</p>
            </div>
            <div style={styles.roundStatCard}>
              <p style={styles.roundStatLabel}>Rounds Cleared</p>
              <p style={styles.roundStatValue}>{totalRoundsCleared}</p>
            </div>
          </div>

          <div style={styles.roundSummary}>
            {Object.keys(roundWiseSelections).length ? (
              Object.entries(roundWiseSelections).map(([round, count]) => (
                <span key={round} style={styles.roundChip}>
                  {round}: {count}
                </span>
              ))
            ) : (
              <p style={styles.emptyNote}>No round-wise selections yet.</p>
            )}
          </div>

          <div style={styles.tableWrap}>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Rounds Selected</th>
                  <th>Exit Round</th>
                  <th>Elimination Reason</th>
                </tr>
              </thead>
              <tbody>
                {placementProgress.map((item) => (
                  <tr key={`${item.company}-${item.eliminationRound}`}>
                    <td>{item.company}</td>
                    <td>{item.roundsCleared.length ? item.roundsCleared.join(", ") : "None"}</td>
                    <td>{item.eliminationRound || (item.outcome === "Selected" ? "Selected" : "N/A")}</td>
                    <td>{item.outcome === "Selected" ? "Selected" : (item.eliminationReason || "Not specified")}</td>
                  </tr>
                ))}
                {!placementProgress.length && (
                  <tr>
                    <td colSpan="4">No company attempt data available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
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
    width: "64px",
    height: "76px",
    borderRadius: "10px",
    border: "1px solid rgba(103,232,249,0.35)",
    background: "rgba(2,6,23,0.35)",
    objectFit: "contain",
    padding: "2px",
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
  insightGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
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
  checklistWrap: {
    display: "grid",
    gap: "8px",
    marginBottom: "12px",
  },
  checklistRow: {
    display: "grid",
    gridTemplateColumns: "88px 1fr auto",
    gap: "10px",
    alignItems: "center",
  },
  checkOk: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#bbf7d0",
    border: "1px solid rgba(34,197,94,0.4)",
    background: "rgba(34,197,94,0.18)",
    borderRadius: "999px",
    padding: "3px 8px",
    textAlign: "center",
  },
  checkWarn: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#fbcfe8",
    border: "1px solid rgba(244,63,94,0.45)",
    background: "rgba(244,63,94,0.18)",
    borderRadius: "999px",
    padding: "3px 8px",
    textAlign: "center",
  },
  checkLabel: {
    fontSize: "13px",
    color: "#d5e2f2",
  },
  checkCurrent: {
    fontSize: "13px",
    color: "#67e8f9",
    fontWeight: 700,
  },
  progressMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  progressLabel: {
    fontSize: "12px",
    color: "#9db2cf",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  progressValue: {
    fontSize: "14px",
    color: "#67e8f9",
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
  roundStats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "10px",
    marginBottom: "10px",
  },
  roundStatCard: {
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: "12px",
    background: "rgba(15,23,42,0.6)",
    padding: "10px 12px",
  },
  roundStatLabel: {
    margin: 0,
    fontSize: "12px",
    color: "#9db2cf",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  roundStatValue: {
    margin: "6px 0 0 0",
    fontSize: "24px",
    color: "#f8fafc",
    fontWeight: 700,
  },
  roundSummary: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "12px",
  },
  timelineList: {
    display: "grid",
    gap: "10px",
  },
  timelineRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
    border: "1px solid rgba(125,211,252,0.2)",
    background: "rgba(2,6,23,0.45)",
    borderRadius: "10px",
    padding: "9px 10px",
  },
  timelineCompany: {
    margin: 0,
    color: "#f8fafc",
    fontWeight: 700,
    fontSize: "14px",
  },
  timelineRole: {
    margin: "2px 0 0",
    color: "#9db2cf",
    fontSize: "12px",
  },
  timelineMeta: {
    display: "grid",
    gap: "4px",
    justifyItems: "end",
  },
  timelineDate: {
    fontSize: "12px",
    color: "#cbd5e1",
  },
  timelineAction: {
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(103,232,249,0.35)",
    background: "rgba(14,165,233,0.2)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  mockForm: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1.4fr auto",
    gap: "8px",
    marginBottom: "10px",
  },
  resumeLink: {
    color: "#67e8f9",
    fontSize: "12px",
    textDecoration: "underline",
    fontWeight: 700,
  },
  roundChip: {
    borderRadius: "999px",
    border: "1px solid rgba(56,189,248,0.35)",
    background: "rgba(56,189,248,0.14)",
    color: "#d8f5ff",
    fontSize: "12px",
    fontWeight: 700,
    padding: "4px 10px",
  },
  tableWrap: {
    overflowX: "auto",
  },
  emptyNote: {
    margin: "4px 0 0 0",
    color: "#9db2cf",
    fontSize: "13px",
  },
};
