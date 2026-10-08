import { Router } from "express";
import {
  getAdminWorkers,
  getPendingWorkers,
  updateWorkerApproval,
  getAuditLogs,
  getSecurityDreadMatrix,
  getIpTrackingDetails,
  getSecurityAlerts,
  blockUser,
  unblockUser,
} from "../controllers/admin.controller.js";
import { authenticate, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate, allowRoles("ADMIN"));

router.get("/workers", getAdminWorkers);
router.get("/workers/pending", getPendingWorkers);
router.put("/workers/:workerId/approval", updateWorkerApproval);
router.get("/audit-logs", getAuditLogs);
router.get("/security/dread", getSecurityDreadMatrix);
router.get("/security-alerts", getSecurityAlerts);
router.post("/users/:userId/block", blockUser);
router.post("/users/:userId/unblock", unblockUser);
router.get("/ip-tracking", getIpTrackingDetails);

export default router;
