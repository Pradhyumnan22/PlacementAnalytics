import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorRole: { type: String, trim: true, required: true },
    actorId: { type: String, trim: true, required: true },
    action: { type: String, trim: true, required: true },
    targetType: { type: String, trim: true, default: "" },
    targetId: { type: String, trim: true, default: "" },
    summary: { type: String, trim: true, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model("AuditLog", auditLogSchema);

