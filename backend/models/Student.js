import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    regNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    cgpa: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },
    attendance: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    activityPoints: {
      type: Number,
      min: 0,
      default: 0,
    },
    arrears: {
      type: Number,
      min: 0,
      default: 0,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    semesterPerformance: [
      {
        sem: { type: String, required: true },
        cgpa: { type: Number, min: 0, max: 10, required: true },
      },
    ],
    skillScores: [
      {
        name: { type: String, required: true },
        score: { type: Number, min: 0, max: 100, required: true },
      },
    ],
    recentActivities: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model("Student", studentSchema);
