import { Router } from "express";

import {
  getMyWorkerProfile,
  getNearbyWorkers,
  updateMyLocation,
  updateMyStatus
} from "../controllers/workers.controller.js";

import {
  allowRoles,
  authenticate
} from "../middleware/auth.middleware.js";

const router = Router();

router.get("/nearby", getNearbyWorkers);

router.get(
  "/me",
  authenticate,
  allowRoles("WORKER"),
  getMyWorkerProfile
);

router.put(
  "/location",
  authenticate,
  allowRoles("WORKER"),
  updateMyLocation
);

router.put(
  "/status",
  authenticate,
  allowRoles("WORKER"),
  updateMyStatus
);

export default router;