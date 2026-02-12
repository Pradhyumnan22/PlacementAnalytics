import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Analytics from "../models/Analytics.js";

dotenv.config({ path: "./.env" });

const placementTrend = [
  { year: "2021", placed: 40 },
  { year: "2022", placed: 55 },
  { year: "2023", placed: 72 },
  { year: "2024", placed: 88 },
];

const companyOffers = [
  { name: "TCS", offers: 25 },
  { name: "Infosys", offers: 18 },
  { name: "Wipro", offers: 12 },
  { name: "Zoho", offers: 9 },
];

const run = async () => {
  try {
    await connectDB();
    await Analytics.findOneAndUpdate(
      {},
      { placementTrend, companyOffers },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    console.log("Analytics seeded successfully.");
  } catch (error) {
    console.error("Analytics seed failed:", error.message);
  } finally {
    process.exit(0);
  }
};

run();
