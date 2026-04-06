import mongoose from "mongoose";

const STATUS_STAGES = ["Not Ready", "Training", "Eligible", "Applied", "Interview", "Placed"];
const PLACEMENT_OUTCOMES = ["In Process", "Eliminated", "Selected"];

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
    studyYear: {
      type: Number,
      min: 1,
      max: 4,
      default: 1,
    },
    status: {
      type: String,
      enum: STATUS_STAGES,
      default: "Not Ready",
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
    mentorNotes: [
      {
        text: { type: String, required: true, trim: true },
        authorRole: { type: String, required: true, trim: true },
        authorId: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    placementProgress: [
      {
        company: { type: String, required: true, trim: true },
        roundsCleared: [{ type: String, trim: true }],
        eliminationRound: { type: String, trim: true, default: "Selected" },
        eliminationReason: { type: String, trim: true, default: "" },
        outcome: {
          type: String,
          enum: PLACEMENT_OUTCOMES,
          default: "Eliminated",
        },
      },
    ],
    driveApplications: [
      {
        driveId: { type: mongoose.Schema.Types.ObjectId, ref: "Drive", required: true },
        status: {
          type: String,
          enum: ["applied", "withdrawn"],
          default: "applied",
        },
        appliedAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    mockTests: [
      {
        type: { type: String, required: true, trim: true },
        score: { type: Number, min: 0, max: 100, required: true },
        weakTopics: [{ type: String, trim: true }],
        takenAt: { type: Date, default: Date.now },
      },
    ],
    interviews: [
      {
        company: { type: String, required: true, trim: true },
        round: { type: String, required: true, trim: true },
        slotTime: { type: Date, required: true },
        mode: { type: String, trim: true, default: "Online" },
        status: {
          type: String,
          enum: ["Scheduled", "Completed", "Missed", "Accepted", "Declined"],
          default: "Scheduled",
        },
        note: { type: String, trim: true, default: "" },
      },
    ],
    resumeVersions: [
      {
        label: { type: String, required: true, trim: true },
        url: { type: String, required: true, trim: true },
        feedbackStatus: {
          type: String,
          enum: ["Pending", "Reviewed", "Approved"],
          default: "Pending",
        },
        feedbackComment: { type: String, trim: true, default: "" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Student", studentSchema);
