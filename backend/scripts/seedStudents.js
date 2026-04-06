import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import Student from "../models/Student.js";
import { DEFAULT_STUDENT_PASSWORD, STUDENT_SEED_COUNT } from "./studentSeedConfig.js";

dotenv.config({ path: "./.env" });

const firstNames = [
  "Aarav",
  "Ishita",
  "Rohan",
  "Meera",
  "Karthik",
  "Nisha",
  "Vikram",
  "Pooja",
  "Aditya",
  "Sneha",
  "Rahul",
  "Ananya",
  "Harish",
  "Divya",
  "Naveen",
  "Keerthi",
  "Pranav",
  "Lavanya",
  "Surya",
  "Bhavya",
];

const lastNames = [
  "Sharma",
  "Reddy",
  "Patel",
  "Iyer",
  "Kumar",
  "Nair",
  "Gupta",
  "Menon",
  "Verma",
  "Rao",
];

const departments = ["CSE", "ECE", "EEE", "MECH", "IT", "CIVIL"];
const companies = ["TCS", "Infosys", "Wipro", "Zoho", "Cognizant", "Accenture", "HCLTech", "Tech Mahindra"];
const roundPool = ["Aptitude", "Coding", "Technical 1", "Technical 2", "Managerial", "HR"];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[randomInt(0, arr.length - 1)];

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
  values[5].cgpa = Number(cgpa.toFixed(2));
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
    const company = pick(companies);
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
      eliminationReason: selected ? "" : pick([
        "Technical depth needs improvement",
        "Communication confidence was low",
        "Coding test score below cutoff",
        "Domain fundamentals were weak",
      ]),
      outcome: selected ? "Selected" : "Eliminated",
    });
  }

  return progress;
};

const generateStudent = (index, password) => {
  const firstName = pick(firstNames);
  const lastName = pick(lastNames);
  const regNo = `PA24${String(index + 1).padStart(5, "0")}`;
  const cgpa = Number(randomFloat(6.2, 9.8).toFixed(2));

  return {
    name: `${firstName} ${lastName}`,
    regNo,
    password,
    cgpa,
    attendance: randomInt(68, 98),
    activityPoints: randomInt(15, 120),
    arrears: randomInt(0, 3),
    department: pick(departments),
    studyYear: deriveStudyYearFromRegNo(regNo),
    semesterPerformance: buildSemesterPerformance(cgpa),
    skillScores: buildSkillScores(),
    recentActivities: buildRecentActivities(),
    placementProgress: buildPlacementProgress(),
  };
};

const seedStudents = async () => {
  try {
    await connectDB();
    const password = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);
    await Student.deleteMany({});

    const students = Array.from(
      { length: STUDENT_SEED_COUNT },
      (_, index) => generateStudent(index, password)
    );

    const inserted = await Student.insertMany(students, { ordered: false });
    console.log(`Inserted ${inserted.length} students successfully.`);
    console.log(`Default student password: ${DEFAULT_STUDENT_PASSWORD}`);
  } catch (error) {
    console.error("Seeding failed:", error.message);
  } finally {
    process.exit(0);
  }
};

seedStudents();
