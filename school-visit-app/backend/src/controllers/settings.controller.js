import { asyncHandler } from "../utils/asyncHandler.js";
import { getAppSettings, saveAppSettings } from "../services/settings.service.js";

export const getPublicSettingsController = asyncHandler(async (req, res) => {
  const settings = await getAppSettings();
  res.json({
    success: true,    adminEmails: settings.adminEmails,
    commonCc: settings.commonCc,
    stateCcEmails: settings.stateCcEmails,
    programManagers: settings.programManagers,
    workModes: settings.workModes,
    visitPurposes: settings.visitPurposes,
    priorities: settings.priorities,
    updatedBy: settings.updatedBy,
    updatedAt: settings.updatedAt,
  });
});
export const updateSettingsController = asyncHandler(async (req, res) => {
  const settings = await saveAppSettings(req.body, req.userEmail);
  res.json({
    success: true,
    message: "Settings updated.",    adminEmails: settings.adminEmails,
    commonCc: settings.commonCc,
    stateCcEmails: settings.stateCcEmails,
    programManagers: settings.programManagers,
    workModes: settings.workModes,
    visitPurposes: settings.visitPurposes,
    priorities: settings.priorities,
    updatedBy: settings.updatedBy,
    updatedAt: settings.updatedAt,
  });
});
