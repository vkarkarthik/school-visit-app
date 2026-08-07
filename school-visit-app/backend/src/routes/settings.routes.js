import { Router } from "express";
import { getPublicSettingsController, updateSettingsController } from "../controllers/settings.controller.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/public", getPublicSettingsController);
router.put("/", requireAdmin, updateSettingsController);

export default router;
