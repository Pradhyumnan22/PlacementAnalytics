import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Student from "../models/Student.js";

dotenv.config({ path: "./.env" });

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;

const buildSemesterPerformance = (cgpa) => {
  const values = [];
  let current = Math.max(6.2, cgpa - randomFloat(0.8, 1.4));
  for (let sem = 1; sem <= 6; sem += 1) {
    current = Math.min(9.9, current + randomFloat(0.1, 0.35));
    values.push({ sem: `S${sem}`, cgpa: Number(current.toFixed(2)) });
  }
  values[5].cgpa = Number((cgpa || 0).toFixed(2));
  return values;
};

const buildSkillScores = () => [
  { name: "Aptitude", score: randomInt(65, 95) },
  { name: "DSA", score: randomInt(60, 92) },
  { name: "Communication", score: randomInt(70, 98) },
  { name: "Projects", score: randomInt(62, 94) },
];

const buildRecentActivities = () => [
  "Completed mock assessment",
  "Updated resume and portfolio",
  "Attended placement workshop",
  "Applied for internship drive",
];

const run = async () => {
  try {
    await connectDB();
    const students = await Student.find();

    for (const student of students) {
      if (!student.semesterPerformance || !student.semesterPerformance.length) {
        student.semesterPerformance = buildSemesterPerformance(student.cgpa || 7);
      }
      if (!student.skillScores || !student.skillScores.length) {
        student.skillScores = buildSkillScores();
      }
      if (!student.recentActivities || !student.recentActivities.length) {
        student.recentActivities = buildRecentActivities();
      }
      await student.save();
    }

    console.log(`Backfilled dashboard data for ${students.length} students.`);
  } catch (error) {
    console.error("Backfill failed:", error.message);
  } finally {
    process.exit(0);
  }
};

run();
