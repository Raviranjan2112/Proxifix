import { Router } from "express";
import {
  getAdminWorkers,
  getPendingWorkers,
  updateWorkerApproval,
  getAuditLogs,
  getSecurityDreadMatrix,
} from "../controllers/admin.controller.js";
import { authenticate, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate, allowRoles("ADMIN"));

router.get("/workers", getAdminWorkers);
router.get("/workers/pending", getPendingWorkers);
router.put("/workers/:workerId/approval", updateWorkerApproval);
router.get("/audit-logs", getAuditLogs);
router.get("/security/dread", getSecurityDreadMatrix);

export default router;
