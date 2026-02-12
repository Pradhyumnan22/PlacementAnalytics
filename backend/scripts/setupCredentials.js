import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import Student from "../models/Student.js";
import Admin from "../models/Admin.js";

dotenv.config({ path: "./.env" });

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";
const OFFICER_USERNAME = "officer";
const OFFICER_PASSWORD = "officer123";

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

    const students = await Student.find().sort({ regNo: 1 });
    const credentialRows = [];

    for (const student of students) {
      const suffix = student.regNo.slice(-5);
      const plainPassword = `stud${suffix}`;
      student.password = await bcrypt.hash(plainPassword, 10);
      await student.save();

      credentialRows.push(`${student.name} | ${student.regNo} | ${plainPassword}`);
    }

    const content = [
      "ADMIN CREDENTIAL",
      `admin id: ${ADMIN_USERNAME}`,
      `admin password: ${ADMIN_PASSWORD}`,
      "",
      "PLACEMENT OFFICER CREDENTIAL",
      `officer id: ${OFFICER_USERNAME}`,
      `officer password: ${OFFICER_PASSWORD}`,
      "",
      "STUDENT CREDENTIALS (id = register number)",
      ...credentialRows,
      "",
      "Note: Students use their regNo as ID and listed password.",
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
