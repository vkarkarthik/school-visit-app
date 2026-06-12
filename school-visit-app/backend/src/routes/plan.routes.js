import { Router } from "express";
import { createPlanController, listPlansController, sendPlanReminderController, updatePlanStatusController } from "../controllers/plan.controller.js";
import { requireUser } from "../middleware/auth.js";

const router = Router();

router.use(requireUser);
router.post("/", createPlanController);
router.get("/", listPlansController);
router.patch("/:id/status", updatePlanStatusController);
router.post("/:id/remind", sendPlanReminderController);

export default router;
