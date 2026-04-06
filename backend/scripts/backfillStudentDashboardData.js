import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Student from "../models/Student.js";

dotenv.config({ path: "./.env" });

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;
const companies = ["TCS", "Infosys", "Wipro", "Zoho", "Cognizant", "Accenture", "HCLTech", "Tech Mahindra"];
const roundPool = ["Aptitude", "Coding", "Technical 1", "Technical 2", "Managerial", "HR"];

const deriveStudyYearFromRegNo = (regNo) => {
  const match = String(regNo || "").toUpperCase().match(/^PA(\d{2})/);
  if (!match) return 1;
  const admissionYear = 2000 + Number(match[1]);
  const currentYear = new Date().getFullYear();
  const computed = currentYear - admissionYear + 1;
  return Math.min(4, Math.max(1, computed));
};

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

const buildPlacementProgress = () => {
  const attempts = randomInt(1, 4);
  const usedCompanies = new Set();
  const progress = [];

  while (progress.length < attempts) {
    const company = companies[randomInt(0, companies.length - 1)];
    if (usedCompanies.has(company)) continue;
    usedCompanies.add(company);

    const maxRounds = randomInt(2, 5);
    const roundsClearedCount = randomInt(0, maxRounds);
    const roundsCleared = roundPool.slice(0, roundsClearedCount);
    const selected = roundsClearedCount === maxRounds && Math.random() > 0.45;

    progress.push({
      company,
      roundsCleared,
      eliminationRound: selected ? "Selected" : roundPool[Math.min(roundsClearedCount, maxRounds - 1)],
      eliminationReason: selected
        ? ""
        : [
            "Technical depth needs improvement",
            "Communication confidence was low",
            "Coding test score below cutoff",
            "Domain fundamentals were weak",
          ][randomInt(0, 3)],
      outcome: selected ? "Selected" : "Eliminated",
    });
  }

  return progress;
};

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
      const derivedStudyYear = deriveStudyYearFromRegNo(student.regNo);
      if (student.studyYear !== derivedStudyYear) {
        student.studyYear = derivedStudyYear;
      }
      if (!student.placementProgress || !student.placementProgress.length) {
        student.placementProgress = buildPlacementProgress();
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
