import { Router } from "express";

import {
  cancelBooking,
  confirmBookingArrival,
  createReview,
  createBooking,
  getBookingById,
  getMyBookings,
  recordBookingPayment,
  updateBookingStatus,
  updateBookingTrackingLocation,
  uploadBookingCompletionPhoto,
} from "../controllers/bookings.controller.js";
import { uploadCompletionPhoto } from "../middleware/upload.middleware.js";

import {
  allowRoles,
  authenticate
} from "../middleware/auth.middleware.js";

const router = Router();

router.post(
  "/",
  authenticate,
  allowRoles("CUSTOMER"),
  createBooking
);

router.get(
  "/",
  authenticate,
  allowRoles("CUSTOMER", "WORKER"),
  getMyBookings
);

router.get(
  "/:id",
  authenticate,
  allowRoles("CUSTOMER", "WORKER"),
  getBookingById
);

router.put(
  "/:id/status",
  authenticate,
  allowRoles("WORKER"),
  updateBookingStatus
);

router.put(
  "/:id/tracking-location",
  authenticate,
  allowRoles("WORKER"),
  updateBookingTrackingLocation
);

router.post(
  "/:id/arrival",
  authenticate,
  allowRoles("WORKER"),
  confirmBookingArrival
);

router.post(
  "/:id/completion-photo",
  authenticate,
  allowRoles("WORKER"),
  uploadCompletionPhoto,
  uploadBookingCompletionPhoto
);

router.post(
  "/:id/review",
  authenticate,
  allowRoles("CUSTOMER"),
  createReview
);

router.post(
  "/:id/payment",
  authenticate,
  allowRoles("CUSTOMER"),
  recordBookingPayment
);

router.post(
  "/:id/cancel",
  authenticate,
  allowRoles("CUSTOMER"),
  cancelBooking
);

export default router;
