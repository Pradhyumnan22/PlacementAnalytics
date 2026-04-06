import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    audience: {
      roles: [{ type: String, enum: ["student", "admin", "placement_officer"] }],
      departments: [{ type: String, trim: true }],
      years: [{ type: Number, min: 1, max: 4 }],
      statuses: [{ type: String, trim: true }],
    },
    expiresAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Announcement", announcementSchema);

