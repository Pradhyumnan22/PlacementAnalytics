import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import connectDB from "./config/db.js";
import Student from "./models/Student.js";
import Admin from "./models/Admin.js";
import Analytics from "./models/Analytics.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const hasAnyRole = (userRole, allowedRoles) => allowedRoles.includes(userRole);

// ================= AUTH MIDDLEWARE =================
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

// ================= ADMIN REGISTER =================
app.post("/api/admin/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ msg: "username and password are required" });
    }

    const existingAdmin = await Admin.findOne({ username: username.toLowerCase() });
    if (existingAdmin) {
      return res.status(409).json({ msg: "Admin already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ username, password: hashed });

    res.status(201).json({ id: admin._id, username: admin.username });
  } catch (error) {
    res.status(500).json({ msg: "Failed to register admin", error: error.message });
  }
});

// ================= LOGIN =================
app.post("/api/login", async (req, res) => {
  try {
    const { id, password, role } = req.body;
    if (!id || !password || !role) {
      return res.status(400).json({ msg: "id, password, and role are required" });
    }

    if (role === "admin" || role === "placement_officer") {
      const admin = await Admin.findOne({ username: id.toLowerCase() });
      if (!admin) return res.status(400).json({ msg: "Admin not found" });

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) return res.status(400).json({ msg: "Wrong password" });
      const accountRole = admin.role || "admin";

      if (role === "placement_officer" && accountRole !== "placement_officer") {
        return res.status(403).json({ msg: "Not a placement officer account" });
      }

      if (role === "admin" && accountRole !== "admin") {
        return res.status(403).json({ msg: "Not an admin account" });
      }

      const token = jwt.sign({ id: admin._id, role: accountRole }, process.env.JWT_SECRET);
      return res.json({ token });
    }

    if (role === "student") {
      const student = await Student.findOne({ regNo: id.toUpperCase() });
      if (!student) return res.status(400).json({ msg: "Student not found" });

      const isMatch = await bcrypt.compare(password, student.password);
      if (!isMatch) return res.status(400).json({ msg: "Wrong password" });

      const token = jwt.sign({ id: student._id, role: "student" }, process.env.JWT_SECRET);
      return res.json({ token });
    }

    return res.status(400).json({ msg: "Invalid role" });
  } catch (error) {
    return res.status(500).json({ msg: "Login failed", error: error.message });
  }
});

// ================= ADMIN: ADD STUDENT =================
app.post("/api/students", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ msg: "Forbidden" });

    const { name, regNo, password, cgpa, attendance, activityPoints, arrears, department } = req.body;
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
    });

    const safeStudent = student.toObject();
    delete safeStudent.password;
    res.status(201).json(safeStudent);
  } catch (error) {
    res.status(500).json({ msg: "Failed to add student", error: error.message });
  }
});

// ================= ADMIN: GET ALL STUDENTS =================
app.get("/api/students", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const students = await Student.find().select("-password");
    res.json(students);
  } catch (error) {
    res.status(500).json({ msg: "Failed to fetch students", error: error.message });
  }
});

// ================= ADMIN: GET ONE STUDENT =================
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

// ================= ADMIN/OFFICER: UPDATE ONE STUDENT =================
app.patch("/api/students/:regNo", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const allowedFields = ["cgpa", "attendance", "activityPoints", "arrears", "department", "name"];
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

    return res.json(student);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to update student", error: error.message });
  }
});

// ================= ADMIN: GET ANALYTICS =================
app.get("/api/admin/analytics", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const analytics = await Analytics.findOne();
    if (!analytics) {
      return res.json({ placementTrend: [], companyOffers: [] });
    }

    return res.json({
      placementTrend: analytics.placementTrend || [],
      companyOffers: analytics.companyOffers || [],
    });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to fetch analytics", error: error.message });
  }
});

// ================= ADMIN: UPSERT ANALYTICS =================
app.post("/api/admin/analytics", authMiddleware, async (req, res) => {
  try {
    if (!hasAnyRole(req.user.role, ["admin", "placement_officer"])) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const { placementTrend, companyOffers } = req.body;
    const analytics = await Analytics.findOneAndUpdate(
      {},
      {
        placementTrend: placementTrend || [],
        companyOffers: companyOffers || [],
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    return res.json(analytics);
  } catch (error) {
    return res.status(500).json({ msg: "Failed to save analytics", error: error.message });
  }
});

// ================= STUDENT DASHBOARD =================
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

// ================= SERVER =================
const startServer = async () => {
  try {
    await connectDB();
    app.listen(5000, () => console.log("Server running on port 5000"));
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
