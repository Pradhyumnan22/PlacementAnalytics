import mongoose from "mongoose";

const driveSchema = new mongoose.Schema(
  {
    company: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    deadline: { type: Date, required: true },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    eligibility: {
      minCgpa: { type: Number, min: 0, max: 10, default: 0 },
      minAttendance: { type: Number, min: 0, max: 100, default: 0 },
      maxArrears: { type: Number, min: 0, default: 99 },
      allowedDepartments: [{ type: String, trim: true }],
      allowedYears: [{ type: Number, min: 1, max: 4 }],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Drive", driveSchema);

