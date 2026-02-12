import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema(
  {
    placementTrend: [
      {
        year: { type: String, required: true },
        placed: { type: Number, required: true, min: 0 },
      },
    ],
    companyOffers: [
      {
        name: { type: String, required: true },
        offers: { type: Number, required: true, min: 0 },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Analytics", analyticsSchema);
