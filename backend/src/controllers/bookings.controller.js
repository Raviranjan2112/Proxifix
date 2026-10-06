import { z } from "zod";
import { unlink } from "node:fs/promises";
import { pool } from "../config/db.js";

const createBookingSchema = z.object({
  workerId: z.string().uuid(),
  serviceCategoryId: z.string().uuid(),
  serviceDescription: z.string().trim().min(10).max(2000),
  customerAddress: z.string().trim().min(5).max(500),
  customerLatitude: z.coerce.number().min(-90).max(90),
  customerLongitude: z.coerce.number().min(-180).max(180),
  scheduledTime: z.string().datetime().optional(),
});

const statusSchema = z.object({
  status: z.enum([
    "ACCEPTED",
    "REJECTED",
    "ARRIVING",
    "STARTED",
    "COMPLETED",
  ]),
});

const reviewSchema = z.object({
  rating: z.coerce
    .number()
    .min(1)
    .max(5)
    .refine((value) => Number.isInteger(value * 2), {
      message: "Rating must use whole or half stars.",
    }),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
});

const trackingLocationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracyMeters: z.coerce.number().min(0).max(100000).optional(),
});

const paymentSchema = z.object({
  paymentMethod: z.enum(["UPI", "CASH", "BANK_TRANSFER"]),
});

async function createNotification(client, { userId, title, body, type, data = {} }) {
  await client.query(
    `
      INSERT INTO notifications (user_id, title, body, notification_type, data)
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [userId, title, body, type, JSON.stringify(data)]
  );
}

async function removeUploadedFile(file) {
  if (file?.path) {
    await unlink(file.path).catch(() => undefined);
  }
}

function allowedNextStatus(currentStatus, nextStatus) {
  const allowed = {
    PENDING: ["ACCEPTED", "REJECTED"],
    ACCEPTED: ["ARRIVING"],
    ARRIVING: ["STARTED"],
    STARTED: ["COMPLETED"],
  };

  return allowed[currentStatus]?.includes(nextStatus) || false;
}

export async function createBooking(request, response) {
  const validation = createBookingSchema.safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message:
        "Provide valid worker, service, address, description, and current location.",
    });
  }

  const data = validation.data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Store the customer's latest location only when they create a booking.
    const customerLocationResult = await client.query(
      `
        UPDATE customers
        SET current_location =
          ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography
        WHERE user_id = $1
        RETURNING current_location
      `,
      [
        request.user.sub,
        data.customerLatitude,
        data.customerLongitude,
      ]
    );

    if (customerLocationResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return response.status(404).json({
        success: false,
        message: "Customer profile was not found.",
      });
    }

    const workerServiceResult = await client.query(
      `
        SELECT
          ws.id AS worker_service_id,
          ws.minimum_charge,
          w.current_location,
          w.verification_status,
          w.online_status,
          w.availability_status
        FROM worker_services ws
        JOIN workers w ON w.user_id = ws.worker_id
        WHERE ws.worker_id = $1
          AND ws.service_category_id = $2
          AND ws.is_active = TRUE
        FOR UPDATE OF w
      `,
      [data.workerId, data.serviceCategoryId]
    );

    if (workerServiceResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return response.status(404).json({
        success: false,
        message: "The selected worker does not offer this service.",
      });
    }

    const workerService = workerServiceResult.rows[0];

    if (
      workerService.verification_status !== "APPROVED" ||
      !workerService.online_status ||
      workerService.availability_status !== "AVAILABLE" ||
      workerService.current_location === null
    ) {
      await client.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message: "This worker is currently unavailable.",
      });
    }

    const bookingResult = await client.query(
      `
        INSERT INTO bookings (
          customer_id,
          worker_id,
          worker_service_id,
          customer_location,
          worker_location,
          customer_address,
          service_description,
          booking_status,
          scheduled_time,
          estimated_price
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          'PENDING',
          $8,
          $9
        )
        RETURNING id, booking_status, estimated_price, created_at
      `,
      [
        request.user.sub,
        data.workerId,
        workerService.worker_service_id,
        customerLocationResult.rows[0].current_location,
        workerService.current_location,
        data.customerAddress,
        data.serviceDescription,
        data.scheduledTime || null,
        workerService.minimum_charge,
      ]
    );

    await client.query("COMMIT");

    return response.status(201).json({
      success: true,
      message: "Booking request sent to the worker.",
      booking: bookingResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    return response.status(500).json({
      success: false,
      message: "Could not create booking.",
    });
  } finally {
    client.release();
  }
}

export async function getMyBookings(request, response) {
  try {
    const isCustomer = request.user.role === "CUSTOMER";

    const result = await pool.query(
      `
        SELECT
          b.id,
          b.booking_status,
          b.customer_address,
          b.service_description,
          b.scheduled_time,
          b.estimated_price,
          b.final_price,
          b.created_at,
          b.arrived_at,
          b.completed_at,
          b.completion_photo_url,

          customer.name AS customer_name,
          customer.phone AS customer_phone,
          worker.name AS worker_name,
          worker.phone AS worker_phone,

          sc.id AS service_category_id,
          sc.name AS service_name,
          review.rating AS review_rating,
          review.comment AS review_comment,
          review.created_at AS review_created_at,
          (review.id IS NOT NULL) AS has_review,

          payment.payment_status,
          payment.payment_method,
          payment.amount AS payment_amount,
          payment.paid_at,

          ROUND(ST_Y(b.customer_location::geometry)::numeric, 6) AS customer_latitude,
          ROUND(ST_X(b.customer_location::geometry)::numeric, 6) AS customer_longitude,
          ROUND(ST_Y(b.worker_location::geometry)::numeric, 6) AS worker_latitude,
          ROUND(ST_X(b.worker_location::geometry)::numeric, 6) AS worker_longitude,

          ROUND(
            (
              ST_Distance(b.customer_location, b.worker_location) / 1000
            )::numeric,
            2
          ) AS distance_km,

          CASE
            WHEN b.worker_location IS NOT NULL THEN GREATEST(
              1,
              CEIL((ST_Distance(b.customer_location, b.worker_location) / 1000 / 30) * 60)::INTEGER
            )
          END AS eta_minutes

        FROM bookings b
        JOIN users customer ON customer.id = b.customer_id
        JOIN users worker ON worker.id = b.worker_id
        JOIN worker_services ws ON ws.id = b.worker_service_id
        JOIN service_categories sc ON sc.id = ws.service_category_id
        LEFT JOIN reviews review ON review.booking_id = b.id
        LEFT JOIN LATERAL (
          SELECT payment_status, payment_method, amount, paid_at
          FROM payments
          WHERE booking_id = b.id
          ORDER BY created_at DESC
          LIMIT 1
        ) payment ON TRUE

        WHERE ${
          isCustomer
            ? "b.customer_id = $1"
            : "b.worker_id = $1"
        }

        ORDER BY b.created_at DESC
      `,
      [request.user.sub]
    );

    return response.json({
      success: true,
      bookings: result.rows,
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      success: false,
      message: "Could not load bookings.",
    });
  }
}

export async function getBookingById(request, response) {
  try {
    const result = await pool.query(
      `
        SELECT
          b.*,
          customer.name AS customer_name,
          worker.name AS worker_name,
          sc.name AS service_name
        FROM bookings b
        JOIN users customer ON customer.id = b.customer_id
        JOIN users worker ON worker.id = b.worker_id
        JOIN worker_services ws ON ws.id = b.worker_service_id
        JOIN service_categories sc ON sc.id = ws.service_category_id
        WHERE b.id = $1
          AND (
            b.customer_id = $2
            OR b.worker_id = $2
          )
      `,
      [request.params.id, request.user.sub]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({
        success: false,
        message: "Booking was not found.",
      });
    }

    return response.json({
      success: true,
      booking: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      success: false,
      message: "Could not load booking.",
    });
  }
}

export async function updateBookingStatus(request, response) {
  const validation = statusSchema.safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message: "Provide a valid booking status.",
    });
  }

  const nextStatus = validation.data.status;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const bookingResult = await client.query(
      `
        SELECT
          b.id,
          b.worker_id,
          b.customer_id,
          b.booking_status,
          b.arrived_at,
          b.completion_photo_url,
          worker.name AS worker_name
        FROM bookings b
        JOIN users worker ON worker.id = b.worker_id
        WHERE b.id = $1
        FOR UPDATE OF b
      `,
      [request.params.id]
    );

    if (bookingResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return response.status(404).json({
        success: false,
        message: "Booking was not found.",
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.worker_id !== request.user.sub) {
      await client.query("ROLLBACK");

      return response.status(403).json({
        success: false,
        message: "Only the assigned worker can update this booking.",
      });
    }

    if (!allowedNextStatus(booking.booking_status, nextStatus)) {
      await client.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message: `Cannot change ${booking.booking_status} to ${nextStatus}.`,
      });
    }

    if (nextStatus === "STARTED" && !booking.arrived_at) {
      await client.query("ROLLBACK");
      return response.status(409).json({
        success: false,
        message: "Confirm that you reached the customer within 100 m before starting work.",
      });
    }

    if (nextStatus === "COMPLETED" && !booking.completion_photo_url) {
      await client.query("ROLLBACK");
      return response.status(409).json({
        success: false,
        message: "Upload a completion photo before marking this service as completed.",
      });
    }

    const updatedResult = await client.query(
      `
        UPDATE bookings
        SET
          booking_status = $2::booking_status,
          accepted_at = CASE
            WHEN $2::booking_status = 'ACCEPTED'::booking_status THEN NOW()
            ELSE accepted_at
          END,
          completed_at = CASE
            WHEN $2::booking_status = 'COMPLETED'::booking_status THEN NOW()
            ELSE completed_at
          END
        WHERE id = $1
        RETURNING id, booking_status, accepted_at, arrived_at, completed_at, completion_photo_url
      `,
      [booking.id, nextStatus]
    );

    if (nextStatus === "ACCEPTED") {
      await client.query(
        `
          UPDATE workers
          SET availability_status = 'BUSY'
          WHERE user_id = $1
        `,
        [request.user.sub]
      );

      await createNotification(client, {
        userId: booking.customer_id,
        title: "Your booking was accepted",
        body: `${booking.worker_name} accepted your service request. You can contact the worker from your dashboard.`,
        type: "BOOKING_ACCEPTED",
        data: { bookingId: booking.id },
      });
    }

    if (nextStatus === "ARRIVING") {
      await createNotification(client, {
        userId: booking.customer_id,
        title: "Your worker is on the way",
        body: `${booking.worker_name} has started travelling to your address.`,
        type: "WORKER_ARRIVING",
        data: { bookingId: booking.id },
      });
    }

    if (nextStatus === "STARTED") {
      await createNotification(client, {
        userId: booking.customer_id,
        title: "Service work has started",
        body: `${booking.worker_name} has arrived and started working on your service request.`,
        type: "SERVICE_STARTED",
        data: { bookingId: booking.id },
      });
    }

    if (nextStatus === "REJECTED" || nextStatus === "COMPLETED") {
      await client.query(
        `
          UPDATE workers
          SET availability_status =
            CASE
              WHEN online_status = TRUE THEN 'AVAILABLE'::availability_status
              ELSE 'OFFLINE'::availability_status
            END
          WHERE user_id = $1
        `,
        [request.user.sub]
      );
    }

    if (nextStatus === "REJECTED") {
      await createNotification(client, {
        userId: booking.customer_id,
        title: "Booking not accepted",
        body: `${booking.worker_name} could not accept this service request. You can choose another available worker.`,
        type: "BOOKING_REJECTED",
        data: { bookingId: booking.id },
      });
    }

    if (nextStatus === "COMPLETED") {
      await client.query(
        `
          INSERT INTO payments (booking_id, amount, payment_method, payment_status)
          SELECT id, COALESCE(final_price, estimated_price), 'PENDING_CUSTOMER_PAYMENT', 'PENDING'
          FROM bookings
          WHERE id = $1
          ON CONFLICT (booking_id) DO NOTHING
        `,
        [booking.id]
      );

      await createNotification(client, {
        userId: booking.customer_id,
        title: "Service completed successfully",
        body: `${booking.worker_name} marked the service as completed and shared a completion photo. Please make payment and rate the service.`,
        type: "SERVICE_COMPLETED",
        data: { bookingId: booking.id },
      });
    }

    await client.query("COMMIT");

    return response.json({
      success: true,
      message: `Booking status changed to ${nextStatus}.`,
      booking: updatedResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    return response.status(500).json({
      success: false,
      message: "Could not update booking status.",
    });
  } finally {
    client.release();
  }
}

export async function updateBookingTrackingLocation(request, response) {
  const validation = trackingLocationSchema.safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message: "A valid current location is required for live tracking.",
    });
  }

  const { latitude, longitude, accuracyMeters } = validation.data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const bookingResult = await client.query(
      `
        SELECT id, worker_id, booking_status
        FROM bookings
        WHERE id = $1
        FOR UPDATE
      `,
      [request.params.id]
    );

    if (bookingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return response.status(404).json({ success: false, message: "Booking was not found." });
    }

    const booking = bookingResult.rows[0];

    if (booking.worker_id !== request.user.sub) {
      await client.query("ROLLBACK");
      return response.status(403).json({ success: false, message: "Only the assigned worker can share this tracking location." });
    }

    if (booking.booking_status !== "ARRIVING") {
      await client.query("ROLLBACK");
      return response.status(409).json({ success: false, message: "Live location can be shared while travelling to the customer." });
    }

    const trackingResult = await client.query(
      `
        UPDATE bookings
        SET worker_location = ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          ROUND(ST_Y(worker_location::geometry)::numeric, 6) AS worker_latitude,
          ROUND(ST_X(worker_location::geometry)::numeric, 6) AS worker_longitude,
          ROUND(ST_Distance(customer_location, worker_location)::numeric, 0) AS distance_meters,
          GREATEST(1, CEIL((ST_Distance(customer_location, worker_location) / 1000 / 30) * 60)::INTEGER) AS eta_minutes
      `,
      [booking.id, latitude, longitude]
    );

    await client.query(
      `
        UPDATE workers
        SET current_location = ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
            last_location_updated_at = NOW()
        WHERE user_id = $1
      `,
      [request.user.sub, latitude, longitude]
    );

    await client.query(
      `
        INSERT INTO worker_locations (worker_id, location, accuracy_meters)
        VALUES ($1, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, $4)
      `,
      [request.user.sub, latitude, longitude, accuracyMeters ?? null]
    );

    await client.query("COMMIT");

    return response.json({
      success: true,
      message: "Live location updated.",
      tracking: trackingResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return response.status(500).json({ success: false, message: "Could not update live location." });
  } finally {
    client.release();
  }
}

export async function confirmBookingArrival(request, response) {
  const validation = trackingLocationSchema.safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message: "Allow current location access to verify your arrival.",
    });
  }

  const { latitude, longitude, accuracyMeters } = validation.data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const bookingResult = await client.query(
      `
        SELECT
          b.id,
          b.worker_id,
          b.customer_id,
          b.booking_status,
          b.arrived_at,
          worker.name AS worker_name,
          ROUND(
            ST_Distance(
              b.customer_location,
              ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography
            )::numeric,
            1
          ) AS distance_meters
        FROM bookings b
        JOIN users worker ON worker.id = b.worker_id
        WHERE b.id = $1
        FOR UPDATE OF b
      `,
      [request.params.id, latitude, longitude]
    );

    if (bookingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return response.status(404).json({ success: false, message: "Booking was not found." });
    }

    const booking = bookingResult.rows[0];

    if (booking.worker_id !== request.user.sub) {
      await client.query("ROLLBACK");
      return response.status(403).json({ success: false, message: "Only the assigned worker can confirm arrival." });
    }

    if (booking.booking_status !== "ARRIVING") {
      await client.query("ROLLBACK");
      return response.status(409).json({ success: false, message: "Start travelling before confirming arrival." });
    }

    if (booking.arrived_at) {
      await client.query("ROLLBACK");
      return response.status(409).json({ success: false, message: "Arrival was already confirmed for this booking." });
    }

    const distanceMeters = Number(booking.distance_meters);

    if (distanceMeters > 100) {
      await client.query("ROLLBACK");
      return response.status(422).json({
        success: false,
        message: `You are ${Math.ceil(distanceMeters)} m from the customer. Move within 100 m to confirm arrival.`,
        distanceMeters,
      });
    }

    await client.query(
      `
        UPDATE bookings
        SET worker_location = ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
            arrived_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [booking.id, latitude, longitude]
    );

    await client.query(
      `
        UPDATE workers
        SET current_location = ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
            last_location_updated_at = NOW()
        WHERE user_id = $1
      `,
      [request.user.sub, latitude, longitude]
    );

    await client.query(
      `
        INSERT INTO worker_locations (worker_id, location, accuracy_meters)
        VALUES ($1, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, $4)
      `,
      [request.user.sub, latitude, longitude, accuracyMeters ?? null]
    );

    await createNotification(client, {
      userId: booking.customer_id,
      title: "Your worker has arrived",
      body: `${booking.worker_name} has reached your service address and is ready to begin.`,
      type: "WORKER_ARRIVED",
      data: { bookingId: booking.id },
    });

    await client.query("COMMIT");

    return response.json({
      success: true,
      message: "Arrival confirmed. The customer has been notified.",
      distanceMeters,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return response.status(500).json({ success: false, message: "Could not confirm arrival." });
  } finally {
    client.release();
  }
}

export async function uploadBookingCompletionPhoto(request, response) {
  if (!request.file) {
    return response.status(400).json({ success: false, message: "Choose a completion photo to upload." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const bookingResult = await client.query(
      `
        SELECT id, worker_id, booking_status, completion_photo_url
        FROM bookings
        WHERE id = $1
        FOR UPDATE
      `,
      [request.params.id]
    );

    if (bookingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      await removeUploadedFile(request.file);
      return response.status(404).json({ success: false, message: "Booking was not found." });
    }

    const booking = bookingResult.rows[0];

    if (booking.worker_id !== request.user.sub) {
      await client.query("ROLLBACK");
      await removeUploadedFile(request.file);
      return response.status(403).json({ success: false, message: "Only the assigned worker can upload a completion photo." });
    }

    if (booking.booking_status !== "STARTED") {
      await client.query("ROLLBACK");
      await removeUploadedFile(request.file);
      return response.status(409).json({ success: false, message: "Start the service before uploading its completion photo." });
    }

    if (booking.completion_photo_url) {
      await client.query("ROLLBACK");
      await removeUploadedFile(request.file);
      return response.status(409).json({ success: false, message: "A completion photo has already been uploaded for this booking." });
    }

    const completionPhotoUrl = `/uploads/completions/${request.file.filename}`;

    await client.query(
      `
        UPDATE bookings
        SET completion_photo_url = $2, updated_at = NOW()
        WHERE id = $1
      `,
      [booking.id, completionPhotoUrl]
    );

    await client.query("COMMIT");

    return response.status(201).json({
      success: true,
      message: "Completion photo uploaded. You can now mark the service as completed.",
      completionPhotoUrl,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    await removeUploadedFile(request.file);
    console.error(error);
    return response.status(500).json({ success: false, message: "Could not upload the completion photo." });
  } finally {
    client.release();
  }
}

export async function recordBookingPayment(request, response) {
  const validation = paymentSchema.safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({ success: false, message: "Choose UPI, cash, or bank transfer." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const bookingResult = await client.query(
      `
        SELECT b.id, b.customer_id, b.worker_id, b.booking_status,
          COALESCE(b.final_price, b.estimated_price) AS amount,
          worker.name AS worker_name
        FROM bookings b
        JOIN users worker ON worker.id = b.worker_id
        WHERE b.id = $1
        FOR UPDATE OF b
      `,
      [request.params.id]
    );

    if (bookingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return response.status(404).json({ success: false, message: "Booking was not found." });
    }

    const booking = bookingResult.rows[0];

    if (booking.customer_id !== request.user.sub) {
      await client.query("ROLLBACK");
      return response.status(403).json({ success: false, message: "Only the booking customer can record payment." });
    }

    if (booking.booking_status !== "COMPLETED") {
      await client.query("ROLLBACK");
      return response.status(409).json({ success: false, message: "Payment can be recorded after the service is completed." });
    }

    const paymentResult = await client.query(
      `
        INSERT INTO payments (booking_id, amount, payment_method, payment_status, paid_at)
        VALUES ($1, $2, $3, 'PAID', NOW())
        ON CONFLICT (booking_id) DO UPDATE
        SET amount = EXCLUDED.amount,
            payment_method = EXCLUDED.payment_method,
            payment_status = 'PAID',
            paid_at = NOW()
        WHERE payments.payment_status <> 'PAID'
        RETURNING payment_status, payment_method, amount, paid_at
      `,
      [booking.id, booking.amount, validation.data.paymentMethod]
    );

    if (paymentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return response.status(409).json({ success: false, message: "Payment has already been recorded for this service." });
    }

    await createNotification(client, {
      userId: booking.worker_id,
      title: "Payment recorded by customer",
      body: `The customer recorded a ${validation.data.paymentMethod} payment of ₹${Number(booking.amount).toFixed(2)} for this completed service.`,
      type: "PAYMENT_RECORDED",
      data: { bookingId: booking.id, paymentMethod: validation.data.paymentMethod },
    });

    await client.query("COMMIT");

    return response.json({
      success: true,
      message: "Payment recorded successfully. Confirm the amount with the worker.",
      payment: paymentResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return response.status(500).json({ success: false, message: "Could not record payment." });
  } finally {
    client.release();
  }
}

export async function createReview(request, response) {
  const validation = reviewSchema.safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message: "Choose a rating from 1 to 5 stars.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const bookingResult = await client.query(
      `
        SELECT id, customer_id, worker_id, booking_status
        FROM bookings
        WHERE id = $1
        FOR UPDATE
      `,
      [request.params.id]
    );

    if (bookingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return response.status(404).json({ success: false, message: "Booking was not found." });
    }

    const booking = bookingResult.rows[0];

    if (booking.customer_id !== request.user.sub) {
      await client.query("ROLLBACK");
      return response.status(403).json({ success: false, message: "Only the booking customer can leave a review." });
    }

    if (booking.booking_status !== "COMPLETED") {
      await client.query("ROLLBACK");
      return response.status(409).json({ success: false, message: "A service can be rated only after it is completed." });
    }

    const reviewResult = await client.query(
      `
        INSERT INTO reviews (booking_id, customer_id, worker_id, rating, comment)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, rating, comment, created_at
      `,
      [booking.id, booking.customer_id, booking.worker_id, validation.data.rating, validation.data.comment || null]
    );

    const workerResult = await client.query(
      `
        UPDATE workers
        SET average_rating = summary.average_rating, total_reviews = summary.total_reviews
        FROM (
          SELECT ROUND(AVG(rating)::numeric, 1) AS average_rating, COUNT(*)::int AS total_reviews
          FROM reviews
          WHERE worker_id = $1
        ) summary
        WHERE user_id = $1
        RETURNING workers.average_rating, workers.total_reviews
      `,
      [booking.worker_id]
    );

    await client.query("COMMIT");

    return response.status(201).json({
      success: true,
      message: "Thank you. Your rating has been saved.",
      review: reviewResult.rows[0],
      workerRating: workerResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return response.status(409).json({
        success: false,
        message: "You have already rated this completed service.",
      });
    }

    console.error(error);
    return response.status(500).json({ success: false, message: "Could not save your rating." });
  } finally {
    client.release();
  }
}

export async function cancelBooking(request, response) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const bookingResult = await client.query(
      `
        SELECT id, customer_id, worker_id, booking_status
        FROM bookings
        WHERE id = $1
        FOR UPDATE
      `,
      [request.params.id]
    );

    if (bookingResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return response.status(404).json({
        success: false,
        message: "Booking was not found.",
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.customer_id !== request.user.sub) {
      await client.query("ROLLBACK");

      return response.status(403).json({
        success: false,
        message: "Only the customer can cancel this booking.",
      });
    }

    if (!["PENDING", "ACCEPTED"].includes(booking.booking_status)) {
      await client.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message: "This booking can no longer be cancelled.",
      });
    }

    await client.query(
      `
        UPDATE bookings
        SET booking_status = 'CANCELLED', cancelled_at = NOW()
        WHERE id = $1
      `,
      [booking.id]
    );

    if (booking.booking_status === "ACCEPTED") {
      await client.query(
        `
          UPDATE workers
          SET availability_status =
            CASE
              WHEN online_status = TRUE THEN 'AVAILABLE'::availability_status
              ELSE 'OFFLINE'::availability_status
            END
          WHERE user_id = $1
        `,
        [booking.worker_id]
      );
    }

    await client.query("COMMIT");

    return response.json({
      success: true,
      message: "Booking cancelled successfully.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    return response.status(500).json({
      success: false,
      message: "Could not cancel booking.",
    });
  } finally {
    client.release();
  }
}
