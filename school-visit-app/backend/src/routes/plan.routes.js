import { Router } from "express";
import { buildPlannerDashboardController, createPlanController, listPlansController, sendPlanReminderController, updatePlanStatusController } from "../controllers/plan.controller.js";
import { requireAdmin, requireUser } from "../middleware/auth.js";

const router = Router();

router.use(requireUser);
router.post("/", createPlanController);
router.get("/", listPlansController);
router.post("/dashboard-sheet", requireAdmin, buildPlannerDashboardController);
router.patch("/:id/status", updatePlanStatusController);
router.post("/:id/remind", sendPlanReminderController);

export default router;
