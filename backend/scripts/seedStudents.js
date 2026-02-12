import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import Student from "../models/Student.js";

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

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[randomInt(0, arr.length - 1)];

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

const generateStudent = async (index) => {
  const firstName = pick(firstNames);
  const lastName = pick(lastNames);
  const regNo = `PA24${String(index + 1).padStart(3, "0")}${randomInt(10, 99)}`;
  const plainPassword = `stud${randomInt(1000, 9999)}`;
  const password = await bcrypt.hash(plainPassword, 10);
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
    semesterPerformance: buildSemesterPerformance(cgpa),
    skillScores: buildSkillScores(),
    recentActivities: buildRecentActivities(),
  };
};

const seedStudents = async () => {
  try {
    await connectDB();

    const students = await Promise.all(
      Array.from({ length: 20 }, (_, index) => generateStudent(index))
    );

    const inserted = await Student.insertMany(students, { ordered: false });
    console.log(`Inserted ${inserted.length} students successfully.`);
  } catch (error) {
    console.error("Seeding failed:", error.message);
  } finally {
    process.exit(0);
  }
};

seedStudents();
