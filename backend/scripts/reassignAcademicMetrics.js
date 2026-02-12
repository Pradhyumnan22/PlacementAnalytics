import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Student from "../models/Student.js";

dotenv.config({ path: "./.env" });

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const reassignMetrics = async () => {
  try {
    await connectDB();

    const students = await Student.find();
    if (!students.length) {
      console.log("No students found.");
      process.exit(0);
    }

    for (const student of students) {
      // Coherent profile score to keep CGPA/attendance/activity aligned.
      const profile = Math.random();
      const cgpaBase = 6.2 + profile * 3.5; // 6.2 to 9.7
      const attendanceBase = 68 + profile * 30; // 68 to 98

      student.cgpa = Number(clamp(cgpaBase + (Math.random() - 0.5) * 0.5, 6, 9.9).toFixed(2));
      student.attendance = Math.round(clamp(attendanceBase + (Math.random() - 0.5) * 8, 65, 99));
      student.activityPoints = Math.round(clamp(20 + profile * 95 + (Math.random() - 0.5) * 16, 5, 120));
      student.arrears = student.cgpa >= 8 ? 0 : student.cgpa >= 7 ? Math.round(Math.random()) : Math.round(Math.random() * 3);

      await student.save();
    }

    console.log(`Updated academic metrics for ${students.length} students.`);
  } catch (error) {
    console.error("Failed to reassign metrics:", error.message);
  } finally {
    process.exit(0);
  }
};

reassignMetrics();
