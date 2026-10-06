import { Router } from "express";
import {
  getAdminWorkers,
  getPendingWorkers,
  updateWorkerApproval,
} from "../controllers/admin.controller.js";
import { authenticate, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate, allowRoles("ADMIN"));

router.get("/workers", getAdminWorkers);
router.get("/workers/pending", getPendingWorkers);
router.put("/workers/:workerId/approval", updateWorkerApproval);

export default router;
