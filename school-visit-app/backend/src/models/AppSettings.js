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
    programManagers: [programManagerSchema],
    updatedBy: { type: String, trim: true, lowercase: true, default: "" },
  },
  { timestamps: true }
);

export const AppSettings = mongoose.model("AppSettings", appSettingsSchema);
