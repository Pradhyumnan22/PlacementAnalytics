import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import Student from "../models/Student.js";
import Admin from "../models/Admin.js";
import { DEFAULT_STUDENT_PASSWORD } from "./studentSeedConfig.js";

dotenv.config({ path: "./.env" });

const ADMIN_USERNAME = "faculty";
const ADMIN_PASSWORD = "faculty123";
const OFFICER_USERNAME = "admin";
const OFFICER_PASSWORD = "admin123";

const setupCredentials = async () => {
  try {
    await connectDB();

    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await Admin.findOneAndUpdate(
      { username: ADMIN_USERNAME },
      { username: ADMIN_USERNAME, password: adminHash, role: "admin" },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    const officerHash = await bcrypt.hash(OFFICER_PASSWORD, 10);
    await Admin.findOneAndUpdate(
      { username: OFFICER_USERNAME },
      { username: OFFICER_USERNAME, password: officerHash, role: "placement_officer" },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    const studentPasswordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);
    await Student.updateMany({}, { $set: { password: studentPasswordHash } });

    const students = await Student.find().sort({ regNo: 1 });
    const credentialRows = [];

    for (const student of students) {
      credentialRows.push(`${student.name} | ${student.regNo} | ${DEFAULT_STUDENT_PASSWORD}`);
    }

    const content = [
      "FACULTY CREDENTIAL",
      `faculty id: ${ADMIN_USERNAME}`,
      `faculty password: ${ADMIN_PASSWORD}`,
      "",
      "ADMIN CREDENTIAL",
      `admin id: ${OFFICER_USERNAME}`,
      `admin password: ${OFFICER_PASSWORD}`,
      "",
      "STUDENT CREDENTIALS (id = register number)",
      ...credentialRows,
      "",
      `Note: Students use their regNo as ID. All student accounts use the same password: ${DEFAULT_STUDENT_PASSWORD}.`,
    ].join("\n");

    const outputPath = path.resolve("student-credentials.txt");
    fs.writeFileSync(outputPath, content, "utf8");

    console.log(`Credentials set for ${students.length} students.`);
    console.log(`Saved credentials to: ${outputPath}`);
  } catch (error) {
    console.error("Failed to set credentials:", error.message);
  } finally {
    process.exit(0);
  }
};

setupCredentials();
