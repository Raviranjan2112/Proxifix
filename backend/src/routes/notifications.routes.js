import { Router } from "express";
import { getMyNotifications, markAllNotificationsRead } from "../controllers/notifications.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", authenticate, getMyNotifications);
router.put("/read", authenticate, markAllNotificationsRead);

export default router;
