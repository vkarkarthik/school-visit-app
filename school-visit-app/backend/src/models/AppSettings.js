import mongoose from "mongoose";

const programManagerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    adminEmails: [{ type: String, trim: true, lowercase: true }],
    commonCc: [{ type: String, trim: true, lowercase: true }],
    stateCcEmails: {
      type: Map,
      of: [{ type: String, trim: true, lowercase: true }],
      default: {},
    },
    programManagers: [programManagerSchema],
    workModes: {
      type: [String],
      default: ["School Visit", "Work From Home", "Work From Office", "Travel", "Other"],
    },
    visitPurposes: {
      type: [String],
      default: [
        "New School Visit / Demo",
        "Teachers Copy",
        "Induction Training",
        "Teachers Training",
        "Robotics Training",
        "Admin Related Work",
        "Software Installation",
        "Other Works",
      ],
    },
    priorities: {
      type: [String],
      default: ["Critical", "High", "Normal"],
    },

    updatedBy: { type: String, trim: true, lowercase: true, default: "" },
  },
  { timestamps: true }
);

export const AppSettings = mongoose.model("AppSettings", appSettingsSchema);
