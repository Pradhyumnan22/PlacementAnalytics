
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import Student from "./models/Student.js";
import Admin from "./models/Admin.js";
import Analytics from "./models/Analytics.js";
import Drive from "./models/Drive.js";
import AuditLog from "./models/AuditLog.js";
import Announcement from "./models/Announcement.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, "../frontend/dist");
const rawCorsOrigins = String(process.env.CORS_ORIGIN || "").trim();
const allowedCorsOrigins = rawCorsOrigins
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors(
  allowedCorsOrigins.length
    ? {
      origin(origin, callback) {
        if (!origin || allowedCorsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("CORS origin not allowed"));
      },
    }
    : undefined
));
app.use(express.json());

const hasAnyRole = (userRole, allowedRoles) => allowedRoles.includes(userRole);
const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const formatIcsDate = (dateInput) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};
const escapeIcsText = (value) => String(value || "")
  .replace(/\\/g, "\\\\")
  .replace(/\n/g, "\\n")
  .replace(/,/g, "\\,")
  .replace(/;/g, "\\;");
const createIcsCalendar = (events) => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PlacementAnalytics//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  events.forEach((event, index) => {
    const start = formatIcsDate(event.start);
    const end = formatIcsDate(event.end || new Date(new Date(event.start).getTime() + (60 * 60 * 1000)));
    if (!start || !end) return;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsText(event.uid || `evt-${index}-${Date.now()}@placement-analytics`)}`);
    lines.push(`DTSTAMP:${formatIcsDate(new Date())}`);
    lines.push(`DTSTART:${start}`);
    lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${escapeIcsText(event.summary || "Event")}`);
    lines.push(`DESCRIPTION:${escapeIcsText(event.description || "")}`);
    lines.push(`LOCATION:${escapeIcsText(event.location || "Campus")}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
};

const deriveStudyYearFromRegNo = (regNo) => {
  const match = String(regNo || "").toUpperCase().match(/^PA(\d{2})/);
  if (!match) return 1;
  const admissionYear = 2000 + Number(match[1]);
  const currentYear = new Date().getFullYear();
  const computed = currentYear - admissionYear + 1;
  return Math.min(4, Math.max(1, computed));
};

const isDepartmentMatch = (studentDepartment, allowedDepartments) => {
  if (!Array.isArray(allowedDepartments) || !allowedDepartments.length) return true;
  const normalizedStudentDepartment = String(studentDepartment || "").trim().toLowerCase();
  const normalizedAllowed = allowedDepartments
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
  return normalizedAllowed.includes(normalizedStudentDepartment);
};

const evaluateDriveEligibility = (student, drive) => {
  const reasons = [];
  const minCgpa = toSafeNumber(drive?.eligibility?.minCgpa, 0);
  const minAttendance = toSafeNumber(drive?.eligibility?.minAttendance, 0);
  const maxArrears = toSafeNumber(drive?.eligibility?.maxArrears, 99);
  const studentCgpa = toSafeNumber(student?.cgpa, 0);
  const studentAttendance = toSafeNumber(student?.attendance, 0);
  const studentArrears = toSafeNumber(student?.arrears, 0);
  const studentYear = toSafeNumber(student?.studyYear, 1);

  if (studentCgpa < minCgpa) reasons.push(`CGPA below ${minCgpa.toFixed(1)}`);
  if (studentAttendance < minAttendance) reasons.push(`Attendance below ${Math.round(minAttendance)}%`);
  if (studentArrears > maxArrears) reasons.push(`Arrears above ${Math.round(maxArrears)}`);

  const allowedYears = Array.isArray(drive?.eligibility?.allowedYears)
    ? drive.eligibility.allowedYears.map((year) => toSafeNumber(year, NaN)).filter((year) => Number.isFinite(year))
    : [];
  if (allowedYears.length && !allowedYears.includes(studentYear)) reasons.push("Study year not eligible");

  if (!isDepartmentMatch(student?.department, drive?.eligibility?.allowedDepartments || [])) {
    reasons.push("Department not eligible");
  }

  return { eligible: reasons.length === 0, reasons };
};

const buildStudentInsights = (student, drives = []) => {
  const checklist = [
    { id: "cgpa", label: "Minimum CGPA 7.0", met: toSafeNumber(student?.cgpa, 0) >= 7, current: toSafeNumber(student?.cgpa, 0).toFixed(2) },
    { id: "attendance", label: "Attendance at least 75%", met: toSafeNumber(student?.attendance, 0) >= 75, current: `${Math.round(toSafeNumber(student?.attendance, 0))}%` },
    { id: "arrears", label: "No active arrears", met: toSafeNumber(student?.arrears, 0) === 0, current: String(Math.round(toSafeNumber(student?.arrears, 0))) },
    { id: "activity", label: "Activity points at least 60", met: toSafeNumber(student?.activityPoints, 0) >= 60, current: String(Math.round(toSafeNumber(student?.activityPoints, 0))) },
  ];

  const readinessScore = Math.max(0, Math.min(100, Math.round((toSafeNumber(student?.cgpa, 0) / 10) * 45 + (Math.min(100, toSafeNumber(student?.attendance, 0)) / 100) * 30 + (Math.min(100, toSafeNumber(student?.activityPoints, 0)) / 100) * 20 + (toSafeNumber(student?.arrears, 0) === 0 ? 5 : 0))));

  const actionPlan = [];
  if (toSafeNumber(student?.cgpa, 0) < 7) actionPlan.push("Improve CGPA to at least 7.0 by focusing on weak subjects.");
  if (toSafeNumber(student?.attendance, 0) < 75) actionPlan.push("Raise attendance above 75% to clear eligibility filters.");
  if (toSafeNumber(student?.activityPoints, 0) < 60) actionPlan.push("Add at least one certification or coding contest this month.");
  if (toSafeNumber(student?.arrears, 0) > 0) actionPlan.push("Clear current arrears before the next drive cycle.");
  if (!actionPlan.length) actionPlan.push("Maintain current metrics and start mock interview practice.");

  const profileFields = [
    String(student?.name || "").trim(),
    String(student?.regNo || "").trim(),
    String(student?.department || "").trim(),
    String(student?.studyYear || "").trim(),
    String(student?.cgpa ?? "").trim(),
    String(student?.attendance ?? "").trim(),
    String(student?.activityPoints ?? "").trim(),
    String(student?.status || "").trim(),
    Array.isArray(student?.recentActivities) && student.recentActivities.length ? "yes" : "",
    Array.isArray(student?.skillScores) && student.skillScores.length ? "yes" : "",
  ];
  const completedFields = profileFields.filter(Boolean).length;
  const profileCompleteness = { score: Math.round((completedFields / profileFields.length) * 100), completed: completedFields, total: profileFields.length };

  const upcomingDrives = drives
    .filter((drive) => String(drive?.status || "").toLowerCase() === "open")
    .map((drive) => {
      const eligibility = evaluateDriveEligibility(student, drive);
      return {
        id: String(drive._id),
        company: String(drive.company || ""),
        title: String(drive.title || ""),
        deadline: drive.deadline,
        eligible: eligibility.eligible,
        reasons: eligibility.reasons,
      };
    })
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 8);

  const notifications = upcomingDrives.slice(0, 4).map((drive) => ({
    type: drive.eligible ? "success" : "warning",
    message: drive.eligible ? `${drive.company} drive is open. You are eligible.` : `${drive.company} drive opened. Improve: ${drive.reasons.join(", ")}`,
    deadline: drive.deadline,
  }));

  return { checklist, readinessScore, actionPlan, profileCompleteness, notifications, upcomingDrives };
};

const recordAudit = async ({ actorRole, actorId, action, targetType = "", targetId = "", summary, metadata = {} }) => {
  try {
    await AuditLog.create({ actorRole, actorId, action, targetType, targetId, summary, metadata });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
};

const parseAuthActor = (req) => ({ actorRole: String(req?.user?.role || "unknown"), actorId: String(req?.user?.id || "unknown") });

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ msg: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ msg: "Invalid token" });
  }
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "placement-analytics-backend" });
});

app.get("/api/login-stats", async (_req, res) => {
  try {
    const students = await Student.find().select("cgpa attendance arrears");
    const totalStudents = students.length;
    const readyStudents = students.filter(
      (student) => toSafeNumber(student.cgpa, 0) >= 7
        && toSafeNumber(student.attendance, 0) >= 75
        && toSafeNumber(student.arrears, 0) === 0
    ).length;
    const readinessRate = totalStudents ? Math.round((readyStudents / totalStudents) * 100) : 0;

    return res.json({ totalStudents, readinessRate });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch login stats", error: error.message });
  }
});

app.post("/api/admin/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ msg: "username and password are required" });
    }

    const existingAdmin = await Admin.findOne({ username: username.toLowerCase() });
    if (existingAdmin) {
      return res.status(409).json({ msg: "Faculty/Admin account already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ username, password: hashed, role: role === "placement_officer" ? "placement_officer" : "admin" });

    res.status(201).json({ id: admin._id, username: admin.username, role: admin.role });
  } catch (error) {
    res.status(500).json({ msg: "Failed to register account", error: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { id, password, role } = req.body;
    if (!id || !password || !role) {
      return res.status(400).json({ msg: "id, password, and role are required" });
    }

    if (role === "admin" || role === "placement_officer") {
      const admin = await Admin.findOne({ username: id.toLowerCase() });
      if (!admin) return res.status(400).json({ msg: "Faculty/Admin account not found" });
      if (admin.active === false) return res.status(403).json({ msg: "Account is deactivated. Contact super admin." });

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) return res.status(400).json({ msg: "Wrong password" });
      const accountRole = admin.role || "admin";

      if (role === "placement_officer" && accountRole !== "placement_officer") {
        return res.status(403).json({ msg: "Not an admin account" });
      }

      if (role === "admin" && accountRole !== "admin") {
        return res.status(403).json({ msg: "Not a faculty account" });
      }

      const token = jwt.sign({ id: admin._id, role: accountRole, username: admin.username }, process.env.JWT_SECRET);
      return res.json({ token });
    }

    if (role === "student") {
      const student = await Student.findOne({ regNo: id.toUpperCase() });
      if (!student) return res.status(400).json({ msg: "Student not found" });

      const isMatch = await bcrypt.compare(password, student.password);
      if (!isMatch) return res.status(400).json({ msg: "Wrong password" });

      const token = jwt.sign({ id: student._id, role: "student", regNo: student.regNo }, process.env.JWT_SECRET);
      return res.json({ token });
    }

    return res.status(400).json({ msg: "Invalid role" });
  } catch (error) {
    return res.status(500).json({ msg: "Login failed", error: error.message });
  }
});
app.post("/api/students", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const { name, regNo, password, cgpa, attendance, activityPoints, arrears, department, studyYear, placementProgress, status } = req.body;
    if (!name || !regNo || !password || !department) {
      return res.status(400).json({ msg: "name, regNo, password, and department are required" });
    }

    const existingStudent = await Student.findOne({ regNo: regNo.toUpperCase() });
    if (existingStudent) {
      return res.status(409).json({ msg: "Student with this register number already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const student = await Student.create({
      name,
      regNo,
      password: hashedPassword,
      cgpa,
      attendance,
      activityPoints,
      arrears,
      department,
      status,
      studyYear: Number.isFinite(Number(studyYear)) ? Math.min(4, Math.max(1, Number(studyYear))) : deriveStudyYearFromRegNo(regNo),
      placementProgress,
    });

    await recordAudit({
      ...parseAuthActor(req),
      action: "CREATE_STUDENT",
      targetType: "student",
      targetId: student.regNo,
      summary: `Created student ${student.regNo}`,
      metadata: { regNo: student.regNo, department: student.department },
    });

    const safeStudent = student.toObject();
    delete safeStudent.password;
    res.status(201).json(safeStudent);
  } catch (error) {
    res.status(500).json({ msg: "Failed to add student", error: error.message });
  }
});

app.get("/api/students", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const students = await Student.find().select("-password").sort({ regNo: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ msg: "Failed to fetch students", error: error.message });
  }
});

app.get("/api/students/:regNo", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const student = await Student.findOne({ regNo: req.params.regNo.toUpperCase() }).select("-password");
    if (!student) return res.status(404).json({ msg: "Student not found" });

    res.json(student);
  } catch (error) {
    res.status(500).json({ msg: "Failed to fetch student", error: error.message });
  }
});

app.patch("/api/students/:regNo", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const allowedFields = ["cgpa", "attendance", "activityPoints", "arrears", "department", "studyYear", "name", "status", "placementProgress", "recentActivities"];
    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ msg: "No valid fields provided for update" });
    }

    const student = await Student.findOneAndUpdate(
      { regNo: req.params.regNo.toUpperCase() },
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!student) return res.status(404).json({ msg: "Student not found" });

    await recordAudit({
      ...parseAuthActor(req),
      action: "UPDATE_STUDENT",
      targetType: "student",
      targetId: student.regNo,
      summary: `Updated student ${student.regNo}`,
      metadata: { fields: Object.keys(updates) },
    });

    return res.json(student);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to update student", error: error.message });
  }
});

app.post("/api/students/:regNo/notes", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ msg: "Note text is required" });
    if (text.length > 500) return res.status(400).json({ msg: "Note is too long (max 500 chars)" });

    const student = await Student.findOneAndUpdate(
      { regNo: req.params.regNo.toUpperCase() },
      {
        $push: {
          mentorNotes: {
            text,
            authorRole: req.user.role,
            authorId: String(req.user.id),
            createdAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true }
    ).select("regNo mentorNotes");

    if (!student) return res.status(404).json({ msg: "Student not found" });

    await recordAudit({
      ...parseAuthActor(req),
      action: "ADD_STUDENT_NOTE",
      targetType: "student",
      targetId: student.regNo,
      summary: `Added mentor note for ${student.regNo}`,
      metadata: { noteLength: text.length },
    });

    return res.json({ regNo: student.regNo, mentorNotes: (student.mentorNotes || []).slice(-20) });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to add note", error: error.message });
  }
});

app.delete("/api/students/:regNo", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const student = await Student.findOneAndDelete({ regNo: req.params.regNo.toUpperCase() }).select("-password");
    if (!student) return res.status(404).json({ msg: "Student not found" });

    await recordAudit({
      ...parseAuthActor(req),
      action: "DELETE_STUDENT",
      targetType: "student",
      targetId: student.regNo,
      summary: `Deleted student ${student.regNo}`,
    });

    return res.json({ msg: "Student deleted", student });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to delete student", error: error.message });
  }
});

app.get("/api/admin/analytics", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const analytics = await Analytics.findOne();
    if (!analytics) return res.json({ placementTrend: [], companyOffers: [] });

    return res.json({ placementTrend: analytics.placementTrend || [], companyOffers: analytics.companyOffers || [] });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch analytics", error: error.message });
  }
});

app.post("/api/admin/analytics", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const { placementTrend, companyOffers } = req.body;
    const analytics = await Analytics.findOneAndUpdate(
      {},
      { placementTrend: placementTrend || [], companyOffers: companyOffers || [] },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await recordAudit({
      ...parseAuthActor(req),
      action: "UPSERT_ANALYTICS",
      targetType: "analytics",
      targetId: String(analytics?._id || ""),
      summary: "Updated analytics",
      metadata: {
        placementTrendCount: (analytics?.placementTrend || []).length,
        companyOfferCount: (analytics?.companyOffers || []).length,
      },
    });

    return res.json(analytics);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to save analytics", error: error.message });
  }
});
app.get("/api/drives", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["student", "admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const drives = await Drive.find().sort({ deadline: 1, createdAt: -1 });
    if (req.user.role !== "student") return res.json(drives);

    const student = await Student.findById(req.user.id).select("cgpa attendance arrears department studyYear driveApplications");
    if (!student) return res.status(404).json({ msg: "Student not found" });
    const applicationMap = (student.driveApplications || []).reduce((acc, item) => {
      acc[String(item.driveId)] = item.status;
      return acc;
    }, {});

    const enriched = drives.map((drive) => {
      const eligibility = evaluateDriveEligibility(student, drive);
      return {
        ...drive.toObject(),
        eligible: eligibility.eligible,
        reasons: eligibility.reasons,
        applicationStatus: applicationMap[String(drive._id)] || "not_applied",
      };
    });

    return res.json(enriched);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch drives", error: error.message });
  }
});

app.post("/api/drives", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "placement_officer") return res.status(403).json({ msg: "Forbidden" });

    const { company, title, deadline, status, eligibility } = req.body;
    if (!company || !title || !deadline) {
      return res.status(400).json({ msg: "company, title, and deadline are required" });
    }

    const drive = await Drive.create({
      company,
      title,
      deadline,
      status: status === "closed" ? "closed" : "open",
      eligibility: {
        minCgpa: toSafeNumber(eligibility?.minCgpa, 0),
        minAttendance: toSafeNumber(eligibility?.minAttendance, 0),
        maxArrears: toSafeNumber(eligibility?.maxArrears, 99),
        allowedDepartments: Array.isArray(eligibility?.allowedDepartments)
          ? eligibility.allowedDepartments.map((item) => String(item || "").trim()).filter(Boolean)
          : [],
        allowedYears: Array.isArray(eligibility?.allowedYears)
          ? eligibility.allowedYears.map((item) => toSafeNumber(item, NaN)).filter((item) => Number.isFinite(item))
          : [],
      },
      createdBy: req.user.id,
    });

    await recordAudit({
      ...parseAuthActor(req),
      action: "CREATE_DRIVE",
      targetType: "drive",
      targetId: String(drive._id),
      summary: `Created drive ${drive.company} - ${drive.title}`,
    });

    return res.status(201).json(drive);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to create drive", error: error.message });
  }
});

app.patch("/api/drives/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "placement_officer") return res.status(403).json({ msg: "Forbidden" });

    const payload = {};
    if (Object.prototype.hasOwnProperty.call(req.body, "company")) payload.company = req.body.company;
    if (Object.prototype.hasOwnProperty.call(req.body, "title")) payload.title = req.body.title;
    if (Object.prototype.hasOwnProperty.call(req.body, "deadline")) payload.deadline = req.body.deadline;
    if (Object.prototype.hasOwnProperty.call(req.body, "status")) payload.status = req.body.status === "closed" ? "closed" : "open";
    if (Object.prototype.hasOwnProperty.call(req.body, "eligibility")) {
      payload.eligibility = {
        minCgpa: toSafeNumber(req.body.eligibility?.minCgpa, 0),
        minAttendance: toSafeNumber(req.body.eligibility?.minAttendance, 0),
        maxArrears: toSafeNumber(req.body.eligibility?.maxArrears, 99),
        allowedDepartments: Array.isArray(req.body.eligibility?.allowedDepartments)
          ? req.body.eligibility.allowedDepartments.map((item) => String(item || "").trim()).filter(Boolean)
          : [],
        allowedYears: Array.isArray(req.body.eligibility?.allowedYears)
          ? req.body.eligibility.allowedYears.map((item) => toSafeNumber(item, NaN)).filter((item) => Number.isFinite(item))
          : [],
      };
    }

    const drive = await Drive.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true, runValidators: true });
    if (!drive) return res.status(404).json({ msg: "Drive not found" });

    await recordAudit({
      ...parseAuthActor(req),
      action: "UPDATE_DRIVE",
      targetType: "drive",
      targetId: String(drive._id),
      summary: `Updated drive ${drive.company} - ${drive.title}`,
      metadata: { fields: Object.keys(payload) },
    });

    return res.json(drive);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to update drive", error: error.message });
  }
});

app.delete("/api/drives/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "placement_officer") return res.status(403).json({ msg: "Forbidden" });

    const drive = await Drive.findByIdAndDelete(req.params.id);
    if (!drive) return res.status(404).json({ msg: "Drive not found" });

    await recordAudit({
      ...parseAuthActor(req),
      action: "DELETE_DRIVE",
      targetType: "drive",
      targetId: String(drive._id),
      summary: `Deleted drive ${drive.company} - ${drive.title}`,
    });

    return res.json({ msg: "Drive deleted", drive });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to delete drive", error: error.message });
  }
});

app.get("/api/student/me", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ msg: "Forbidden" });

    const student = await Student.findById(req.user.id).select("-password");
    if (!student) return res.status(404).json({ msg: "Student not found" });

    res.json(student);
  } catch (error) {
    res.status(500).json({ msg: "Failed to fetch student profile", error: error.message });
  }
});

app.get("/api/student/insights", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ msg: "Forbidden" });

    const student = await Student.findById(req.user.id).select("-password");
    if (!student) return res.status(404).json({ msg: "Student not found" });

    const drives = await Drive.find().sort({ deadline: 1 });
    return res.json(buildStudentInsights(student, drives));
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch student insights", error: error.message });
  }
});

app.post("/api/drives/:id/apply", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ msg: "Forbidden" });

    const drive = await Drive.findById(req.params.id);
    if (!drive) return res.status(404).json({ msg: "Drive not found" });
    if (String(drive.status) !== "open") return res.status(400).json({ msg: "Drive is not open" });

    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ msg: "Student not found" });

    const eligibility = evaluateDriveEligibility(student, drive);
    if (!eligibility.eligible) {
      return res.status(400).json({ msg: "Not eligible for this drive", reasons: eligibility.reasons });
    }

    const existing = (student.driveApplications || []).find((item) => String(item.driveId) === String(drive._id));
    if (existing) {
      existing.status = "applied";
      existing.updatedAt = new Date();
    } else {
      student.driveApplications.push({
        driveId: drive._id,
        status: "applied",
        appliedAt: new Date(),
        updatedAt: new Date(),
      });
    }
    await student.save();

    await recordAudit({
      ...parseAuthActor(req),
      action: "APPLY_DRIVE",
      targetType: "drive",
      targetId: String(drive._id),
      summary: `Applied to drive ${drive.company} - ${drive.title}`,
      metadata: { regNo: student.regNo },
    });

    return res.json({ msg: "Applied successfully" });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to apply drive", error: error.message });
  }
});

app.post("/api/drives/:id/withdraw", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ msg: "Forbidden" });

    const drive = await Drive.findById(req.params.id);
    if (!drive) return res.status(404).json({ msg: "Drive not found" });

    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ msg: "Student not found" });

    const existing = (student.driveApplications || []).find((item) => String(item.driveId) === String(drive._id));
    if (!existing) return res.status(404).json({ msg: "No application found for this drive" });

    existing.status = "withdrawn";
    existing.updatedAt = new Date();
    await student.save();

    await recordAudit({
      ...parseAuthActor(req),
      action: "WITHDRAW_DRIVE",
      targetType: "drive",
      targetId: String(drive._id),
      summary: `Withdrew application from ${drive.company} - ${drive.title}`,
      metadata: { regNo: student.regNo },
    });

    return res.json({ msg: "Withdrawn successfully" });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to withdraw drive", error: error.message });
  }
});

app.post("/api/student/mock-tests", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ msg: "Forbidden" });

    const type = String(req.body?.type || "").trim();
    const score = toSafeNumber(req.body?.score, NaN);
    const weakTopics = Array.isArray(req.body?.weakTopics)
      ? req.body.weakTopics.map((item) => String(item || "").trim()).filter(Boolean)
      : [];

    if (!type || !Number.isFinite(score)) return res.status(400).json({ msg: "type and valid score are required" });

    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ msg: "Student not found" });

    student.mockTests.push({
      type,
      score: Math.max(0, Math.min(100, score)),
      weakTopics,
      takenAt: new Date(),
    });
    await student.save();

    await recordAudit({
      ...parseAuthActor(req),
      action: "ADD_MOCK_TEST",
      targetType: "student",
      targetId: student.regNo,
      summary: `Added mock test ${type} for ${student.regNo}`,
      metadata: { score: Math.max(0, Math.min(100, score)) },
    });

    return res.json({ mockTests: student.mockTests.slice(-20) });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to add mock test", error: error.message });
  }
});

app.post("/api/student/resume", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ msg: "Forbidden" });

    const label = String(req.body?.label || "").trim();
    const url = String(req.body?.url || "").trim();
    if (!label || !url) return res.status(400).json({ msg: "label and url are required" });

    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ msg: "Student not found" });

    student.resumeVersions.push({
      label,
      url,
      feedbackStatus: "Pending",
      feedbackComment: "",
      uploadedAt: new Date(),
    });
    await student.save();

    await recordAudit({
      ...parseAuthActor(req),
      action: "UPLOAD_RESUME",
      targetType: "student",
      targetId: student.regNo,
      summary: `Uploaded resume (${label}) for ${student.regNo}`,
    });

    return res.json({ resumeVersions: student.resumeVersions.slice(-20) });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to upload resume", error: error.message });
  }
});

app.get("/api/student/alerts", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ msg: "Forbidden" });

    const student = await Student.findById(req.user.id).select("cgpa attendance arrears driveApplications interviews");
    if (!student) return res.status(404).json({ msg: "Student not found" });

    const alerts = [];
    if (toSafeNumber(student.cgpa, 0) < 7) alerts.push({ level: "warning", message: "CGPA below placement threshold." });
    if (toSafeNumber(student.attendance, 0) < 75) alerts.push({ level: "warning", message: "Attendance below 75%." });
    if (toSafeNumber(student.arrears, 0) > 0) alerts.push({ level: "warning", message: "Active arrears found." });

    const now = Date.now();
    const interviewsSoon = (student.interviews || []).filter((interview) => {
      const time = new Date(interview.slotTime).getTime();
      return time >= now && time <= now + (72 * 60 * 60 * 1000);
    });
    interviewsSoon.forEach((item) => {
      alerts.push({
        level: "info",
        message: `Interview scheduled with ${item.company} on ${new Date(item.slotTime).toLocaleString()}`,
      });
    });

    return res.json({ alerts });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch alerts", error: error.message });
  }
});

app.get("/api/student/eligibility-simulator", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ msg: "Forbidden" });

    const student = await Student.findById(req.user.id).select("cgpa attendance arrears department studyYear");
    if (!student) return res.status(404).json({ msg: "Student not found" });

    const driveId = String(req.query?.driveId || "").trim();
    const query = { status: "open" };
    if (driveId) query._id = driveId;
    const drives = await Drive.find(query).sort({ deadline: 1 });

    const simulations = drives.map((drive) => {
      const result = evaluateDriveEligibility(student, drive);
      return {
        driveId: String(drive._id),
        company: drive.company,
        title: drive.title,
        deadline: drive.deadline,
        eligible: result.eligible,
        reasons: result.reasons,
      };
    });

    return res.json({ simulations });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to run eligibility simulator", error: error.message });
  }
});

app.get("/api/admin/users", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "placement_officer") return res.status(403).json({ msg: "Forbidden" });

    const users = await Admin.find().select("username role active createdAt updatedAt").sort({ createdAt: -1 });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch users", error: error.message });
  }
});

app.post("/api/admin/users", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "placement_officer") return res.status(403).json({ msg: "Forbidden" });

    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = req.body?.role === "placement_officer" ? "placement_officer" : "admin";

    if (!username || !password) return res.status(400).json({ msg: "username and password are required" });

    const existing = await Admin.findOne({ username });
    if (existing) return res.status(409).json({ msg: "Username already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await Admin.create({ username, password: hashedPassword, role, active: true });

    await recordAudit({
      ...parseAuthActor(req),
      action: "CREATE_USER",
      targetType: "admin_user",
      targetId: String(user._id),
      summary: `Created user ${user.username}`,
      metadata: { role: user.role },
    });

    return res.status(201).json({ _id: user._id, username: user.username, role: user.role, active: user.active, createdAt: user.createdAt });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to create user", error: error.message });
  }
});
app.patch("/api/admin/users/:id/status", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "placement_officer") return res.status(403).json({ msg: "Forbidden" });

    const active = Boolean(req.body?.active);
    const user = await Admin.findByIdAndUpdate(req.params.id, { $set: { active } }, { new: true }).select("username role active");
    if (!user) return res.status(404).json({ msg: "User not found" });

    await recordAudit({
      ...parseAuthActor(req),
      action: "UPDATE_USER_STATUS",
      targetType: "admin_user",
      targetId: String(user._id),
      summary: `${active ? "Activated" : "Deactivated"} user ${user.username}`,
      metadata: { active },
    });

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to update status", error: error.message });
  }
});

app.patch("/api/admin/users/:id/reset-password", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "placement_officer") return res.status(403).json({ msg: "Forbidden" });

    const newPassword = String(req.body?.newPassword || "");
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ msg: "newPassword must be at least 6 characters" });
    }

    const user = await Admin.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await recordAudit({
      ...parseAuthActor(req),
      action: "RESET_USER_PASSWORD",
      targetType: "admin_user",
      targetId: String(user._id),
      summary: `Reset password for ${user.username}`,
    });

    return res.json({ msg: "Password reset successful" });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to reset password", error: error.message });
  }
});

app.get("/api/admin/data-quality", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const students = await Student.find().select("name regNo department studyYear cgpa attendance activityPoints arrears mentorNotes");
    const regNoCounts = students.reduce((acc, student) => {
      const key = String(student.regNo || "").toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const duplicateRegNos = Object.entries(regNoCounts)
      .filter(([, count]) => count > 1)
      .map(([regNo]) => regNo);

    const studentsWithMissingFields = students.filter((student) => {
      return !String(student.name || "").trim() || !String(student.department || "").trim() || !String(student.regNo || "").trim();
    }).length;

    const invalidMetricRecords = students.filter((student) => {
      const cgpa = toSafeNumber(student.cgpa, NaN);
      const attendance = toSafeNumber(student.attendance, NaN);
      const activityPoints = toSafeNumber(student.activityPoints, NaN);
      const arrears = toSafeNumber(student.arrears, NaN);
      return (
        !Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10 ||
        !Number.isFinite(attendance) || attendance < 0 || attendance > 100 ||
        !Number.isFinite(activityPoints) || activityPoints < 0 ||
        !Number.isFinite(arrears) || arrears < 0
      );
    }).length;

    const studentsWithoutNotes = students.filter((student) => !Array.isArray(student.mentorNotes) || !student.mentorNotes.length).length;

    return res.json({
      totalStudents: students.length,
      studentsWithMissingFields,
      invalidMetricRecords,
      duplicateRegNos,
      studentsWithoutNotes,
      profileQualityScore: students.length
        ? Math.max(0, 100 - Math.round(((studentsWithMissingFields + invalidMetricRecords + duplicateRegNos.length) / (students.length * 3)) * 100))
        : 100,
    });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to compute data quality", error: error.message });
  }
});

app.get("/api/admin/kpis", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const students = await Student.find().select("department status cgpa attendance arrears");
    const drives = await Drive.find().select("status deadline");

    const totalStudents = students.length;
    const eligibleStudents = students.filter((s) => toSafeNumber(s.cgpa, 0) >= 7 && toSafeNumber(s.attendance, 0) >= 75 && toSafeNumber(s.arrears, 0) === 0).length;
    const placedStudents = students.filter((s) => String(s.status || "") === "Placed").length;

    const byDepartment = students.reduce((acc, student) => {
      const department = String(student.department || "Unknown").trim() || "Unknown";
      if (!acc[department]) acc[department] = { total: 0, eligible: 0, placed: 0 };
      acc[department].total += 1;
      if (toSafeNumber(student.cgpa, 0) >= 7 && toSafeNumber(student.attendance, 0) >= 75 && toSafeNumber(student.arrears, 0) === 0) {
        acc[department].eligible += 1;
      }
      if (String(student.status || "") === "Placed") acc[department].placed += 1;
      return acc;
    }, {});

    const now = Date.now();
    const openDrives = drives.filter((drive) => String(drive.status || "") === "open").length;
    const drivesClosingSoon = drives.filter((drive) => {
      const time = new Date(drive.deadline).getTime();
      return time >= now && time <= now + (7 * 24 * 60 * 60 * 1000);
    }).length;

    return res.json({
      totalStudents,
      eligibleStudents,
      placedStudents,
      placementRate: totalStudents ? Math.round((placedStudents / totalStudents) * 100) : 0,
      eligibilityRate: totalStudents ? Math.round((eligibleStudents / totalStudents) * 100) : 0,
      byDepartment,
      openDrives,
      drivesClosingSoon,
    });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch KPIs", error: error.message });
  }
});

app.get("/api/admin/audit-logs", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "placement_officer") return res.status(403).json({ msg: "Forbidden" });

    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(120);
    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch audit logs", error: error.message });
  }
});

app.get("/api/admin/drives/summary", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "placement_officer") return res.status(403).json({ msg: "Forbidden" });

    const drives = await Drive.find().sort({ deadline: 1 });
    const students = await Student.find().select("driveApplications");
    const countsByDrive = {};
    students.forEach((student) => {
      (student.driveApplications || []).forEach((application) => {
        const key = String(application.driveId);
        if (!countsByDrive[key]) countsByDrive[key] = { applied: 0, withdrawn: 0 };
        if (application.status === "applied") countsByDrive[key].applied += 1;
        if (application.status === "withdrawn") countsByDrive[key].withdrawn += 1;
      });
    });

    return res.json(
      drives.map((drive) => ({
        ...drive.toObject(),
        applicants: countsByDrive[String(drive._id)]?.applied || 0,
        withdrawals: countsByDrive[String(drive._id)]?.withdrawn || 0,
      }))
    );
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch drive summary", error: error.message });
  }
});

app.post("/api/students/:regNo/interviews", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "placement_officer") return res.status(403).json({ msg: "Forbidden" });

    const company = String(req.body?.company || "").trim();
    const round = String(req.body?.round || "").trim();
    const slotTime = req.body?.slotTime;
    const mode = String(req.body?.mode || "Online").trim();
    const note = String(req.body?.note || "").trim();

    if (!company || !round || !slotTime) {
      return res.status(400).json({ msg: "company, round, and slotTime are required" });
    }

    const student = await Student.findOne({ regNo: req.params.regNo.toUpperCase() });
    if (!student) return res.status(404).json({ msg: "Student not found" });

    student.interviews.push({
      company,
      round,
      slotTime: new Date(slotTime),
      mode,
      status: "Scheduled",
      note,
    });
    await student.save();

    await recordAudit({
      ...parseAuthActor(req),
      action: "SCHEDULE_INTERVIEW",
      targetType: "student",
      targetId: student.regNo,
      summary: `Scheduled ${company} interview (${round}) for ${student.regNo}`,
    });

    return res.json({ interviews: student.interviews.slice(-20) });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to schedule interview", error: error.message });
  }
});

app.patch("/api/student/interviews/:interviewId/respond", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ msg: "Forbidden" });

    const status = req.body?.status === "Declined" ? "Declined" : "Accepted";
    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ msg: "Student not found" });

    const interview = (student.interviews || []).id(req.params.interviewId);
    if (!interview) return res.status(404).json({ msg: "Interview not found" });

    interview.status = status;
    await student.save();

    await recordAudit({
      ...parseAuthActor(req),
      action: "RESPOND_INTERVIEW",
      targetType: "student",
      targetId: student.regNo,
      summary: `Interview ${status.toLowerCase()} by ${student.regNo}`,
      metadata: { interviewId: req.params.interviewId },
    });

    return res.json({ interviews: student.interviews.slice(-20) });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to update interview response", error: error.message });
  }
});

app.patch("/api/students/:regNo/resume/:entryId/feedback", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) return res.status(403).json({ msg: "Forbidden" });

    const status = ["Pending", "Reviewed", "Approved"].includes(String(req.body?.feedbackStatus))
      ? String(req.body.feedbackStatus)
      : "Reviewed";
    const feedbackComment = String(req.body?.feedbackComment || "").trim();

    const student = await Student.findOne({ regNo: req.params.regNo.toUpperCase() });
    if (!student) return res.status(404).json({ msg: "Student not found" });

    const resume = (student.resumeVersions || []).id(req.params.entryId);
    if (!resume) return res.status(404).json({ msg: "Resume entry not found" });

    resume.feedbackStatus = status;
    resume.feedbackComment = feedbackComment;
    await student.save();

    await recordAudit({
      ...parseAuthActor(req),
      action: "REVIEW_RESUME",
      targetType: "student",
      targetId: student.regNo,
      summary: `Resume marked as ${status} for ${student.regNo}`,
    });

    return res.json({ resumeVersions: student.resumeVersions.slice(-20) });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to update resume feedback", error: error.message });
  }
});

app.get("/api/admin/company-pipeline", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) return res.status(403).json({ msg: "Forbidden" });

    const students = await Student.find().select("placementProgress");
    const pipeline = {};
    students.forEach((student) => {
      (student.placementProgress || []).forEach((entry) => {
        const company = String(entry.company || "").trim() || "Unknown";
        if (!pipeline[company]) {
          pipeline[company] = { company, applied: 0, interview: 0, selected: 0, eliminated: 0 };
        }
        pipeline[company].applied += 1;
        const roundsCount = Array.isArray(entry.roundsCleared) ? entry.roundsCleared.length : 0;
        if (roundsCount > 0) pipeline[company].interview += 1;
        if (String(entry.outcome || "") === "Selected") pipeline[company].selected += 1;
        if (String(entry.outcome || "") === "Eliminated") pipeline[company].eliminated += 1;
      });
    });

    return res.json(Object.values(pipeline));
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch company pipeline", error: error.message });
  }
});

app.get("/api/admin/alerts", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) return res.status(403).json({ msg: "Forbidden" });

    const students = await Student.find().select("name regNo cgpa attendance arrears");
    const drives = await Drive.find().select("company title deadline status");
    const alerts = [];

    students.forEach((student) => {
      if (toSafeNumber(student.cgpa, 0) < 7 || toSafeNumber(student.attendance, 0) < 75 || toSafeNumber(student.arrears, 0) > 0) {
        alerts.push({
          type: "student",
          message: `${student.name} (${student.regNo}) is at risk.`,
        });
      }
    });

    const now = Date.now();
    drives.forEach((drive) => {
      const time = new Date(drive.deadline).getTime();
      if (String(drive.status) === "open" && time >= now && time <= now + (48 * 60 * 60 * 1000)) {
        alerts.push({
          type: "drive",
          message: `${drive.company} - ${drive.title} closes within 48 hours.`,
        });
      }
    });

    return res.json({ alerts: alerts.slice(0, 80) });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch alerts", error: error.message });
  }
});

app.get("/api/announcements", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["student", "admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const now = new Date();
    const announcements = await Announcement.find({
      $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
    }).sort({ createdAt: -1 });

    if (req.user.role !== "student") {
      return res.json(announcements.slice(0, 80));
    }

    const student = await Student.findById(req.user.id).select("department studyYear status");
    if (!student) return res.status(404).json({ msg: "Student not found" });
    const studentDepartment = String(student.department || "").trim().toLowerCase();
    const studentYear = Number(student.studyYear || 0);
    const studentStatus = String(student.status || "").trim().toLowerCase();

    const filtered = announcements.filter((announcement) => {
      const roles = Array.isArray(announcement.audience?.roles) ? announcement.audience.roles : [];
      if (roles.length && !roles.includes("student")) return false;

      const departments = Array.isArray(announcement.audience?.departments)
        ? announcement.audience.departments.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
        : [];
      if (departments.length && !departments.includes(studentDepartment)) return false;

      const years = Array.isArray(announcement.audience?.years)
        ? announcement.audience.years.map((item) => Number(item)).filter((item) => Number.isFinite(item))
        : [];
      if (years.length && !years.includes(studentYear)) return false;

      const statuses = Array.isArray(announcement.audience?.statuses)
        ? announcement.audience.statuses.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
        : [];
      if (statuses.length && !statuses.includes(studentStatus)) return false;

      return true;
    });

    return res.json(filtered.slice(0, 80));
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch announcements", error: error.message });
  }
});

app.post("/api/admin/announcements", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "placement_officer") return res.status(403).json({ msg: "Forbidden" });

    const title = String(req.body?.title || "").trim();
    const message = String(req.body?.message || "").trim();
    if (!title || !message) return res.status(400).json({ msg: "title and message are required" });

    const announcement = await Announcement.create({
      title,
      message,
      audience: {
        roles: Array.isArray(req.body?.audience?.roles) ? req.body.audience.roles : ["student"],
        departments: Array.isArray(req.body?.audience?.departments) ? req.body.audience.departments : [],
        years: Array.isArray(req.body?.audience?.years) ? req.body.audience.years : [],
        statuses: Array.isArray(req.body?.audience?.statuses) ? req.body.audience.statuses : [],
      },
      expiresAt: req.body?.expiresAt ? new Date(req.body.expiresAt) : null,
      createdBy: req.user.id,
    });

    await recordAudit({
      ...parseAuthActor(req),
      action: "CREATE_ANNOUNCEMENT",
      targetType: "announcement",
      targetId: String(announcement._id),
      summary: `Created announcement: ${announcement.title}`,
    });

    return res.status(201).json(announcement);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to create announcement", error: error.message });
  }
});

app.get("/api/dashboard/summary", authMiddleware, async (req, res) => {
  try {
    if (req.user.role === "student") {
      const student = await Student.findById(req.user.id).select("name cgpa attendance arrears driveApplications interviews");
      if (!student) return res.status(404).json({ msg: "Student not found" });
      return res.json({
        role: "student",
        headline: `Welcome ${student.name}`,
        highlights: [
          `CGPA: ${toSafeNumber(student.cgpa, 0).toFixed(2)}`,
          `Attendance: ${Math.round(toSafeNumber(student.attendance, 0))}%`,
          `Arrears: ${Math.round(toSafeNumber(student.arrears, 0))}`,
          `Applied Drives: ${(student.driveApplications || []).filter((item) => item.status === "applied").length}`,
        ],
      });
    }

    if (req.user.role === "admin") {
      const students = await Student.find().select("cgpa attendance arrears");
      const atRisk = students.filter((s) => toSafeNumber(s.cgpa, 0) < 7 || toSafeNumber(s.attendance, 0) < 75 || toSafeNumber(s.arrears, 0) > 0).length;
      return res.json({
        role: "faculty",
        headline: "Faculty weekly focus",
        highlights: [`Total students: ${students.length}`, `At-risk students: ${atRisk}`],
      });
    }

    const students = await Student.find().select("status");
    const drives = await Drive.find().select("status");
    const placed = students.filter((s) => String(s.status || "") === "Placed").length;
    return res.json({
      role: "admin",
      headline: "Admin operational health",
      highlights: [
        `Total students: ${students.length}`,
        `Placed: ${placed}`,
        `Open drives: ${drives.filter((d) => String(d.status) === "open").length}`,
      ],
    });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch dashboard summary", error: error.message });
  }
});

app.get("/api/admin/export/students", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) return res.status(403).json({ msg: "Forbidden" });

    const students = await Student.find().select("name regNo department studyYear cgpa attendance activityPoints arrears status");
    const headers = ["Name", "RegNo", "Department", "StudyYear", "CGPA", "Attendance", "ActivityPoints", "Arrears", "Status"];
    const rows = students.map((student) => ([
      student.name,
      student.regNo,
      student.department,
      student.studyYear,
      student.cgpa,
      student.attendance,
      student.activityPoints,
      student.arrears,
      student.status,
    ]));
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=students-export.csv");
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to export students", error: error.message });
  }
});

app.get("/api/student/calendar.ics", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ msg: "Forbidden" });
    const student = await Student.findById(req.user.id).select("regNo interviews");
    if (!student) return res.status(404).json({ msg: "Student not found" });

    const drives = await Drive.find({ status: "open" }).sort({ deadline: 1 });
    const driveEvents = drives.map((drive) => ({
      uid: `drive-${drive._id}@placement-analytics`,
      summary: `${drive.company} - ${drive.title}`,
      description: `Drive deadline for ${drive.company}.`,
      start: new Date(drive.deadline),
      end: new Date(new Date(drive.deadline).getTime() + (30 * 60 * 1000)),
      location: "Placement Cell",
    }));

    const interviewEvents = (student.interviews || []).map((interview, index) => ({
      uid: `student-${student.regNo}-interview-${index}@placement-analytics`,
      summary: `${interview.company} Interview - ${interview.round}`,
      description: `Mode: ${interview.mode || "Online"} | Status: ${interview.status}`,
      start: new Date(interview.slotTime),
      end: new Date(new Date(interview.slotTime).getTime() + (60 * 60 * 1000)),
      location: interview.mode || "Online",
    }));

    const ics = createIcsCalendar([...driveEvents, ...interviewEvents]);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=student-calendar.ics");
    return res.send(ics);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to export student calendar", error: error.message });
  }
});

app.get("/api/admin/calendar.ics", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) return res.status(403).json({ msg: "Forbidden" });

    const drives = await Drive.find({ status: "open" }).sort({ deadline: 1 });
    const students = await Student.find().select("regNo name interviews");

    const driveEvents = drives.map((drive) => ({
      uid: `drive-${drive._id}@placement-analytics`,
      summary: `${drive.company} - ${drive.title}`,
      description: `Open drive deadline (${drive.status}).`,
      start: new Date(drive.deadline),
      end: new Date(new Date(drive.deadline).getTime() + (30 * 60 * 1000)),
      location: "Placement Cell",
    }));

    const interviewEvents = [];
    students.forEach((student) => {
      (student.interviews || []).forEach((interview, index) => {
        interviewEvents.push({
          uid: `student-${student.regNo}-interview-${index}@placement-analytics`,
          summary: `${interview.company} Interview - ${student.regNo}`,
          description: `${student.name || student.regNo} | ${interview.round} | ${interview.status}`,
          start: new Date(interview.slotTime),
          end: new Date(new Date(interview.slotTime).getTime() + (60 * 60 * 1000)),
          location: interview.mode || "Online",
        });
      });
    });

    const ics = createIcsCalendar([...driveEvents, ...interviewEvents]);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=admin-calendar.ics");
    return res.send(ics);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to export admin calendar", error: error.message });
  }
});

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not set in environment variables");
    }

    await connectDB();

    if (process.env.NODE_ENV === "production") {
      app.use(express.static(frontendDistPath));
      app.get(/^\/(?!api).*/, (_req, res) => {
        res.sendFile(path.join(frontendDistPath, "index.html"));
      });
    }

    const port = Number(process.env.PORT) || 5000;
    app.listen(port, () => console.log(`Server running on port ${port}`));
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

if (!process.env.VERCEL) {
  startServer();
}

export default app;
