import { z } from "zod";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { recordAuditLog } from "../utils/auditLogger.js";

const nearbySchema = z.object({
  service: z.string().trim().min(2),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(20).default(10)
});

const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  address: z.string().trim().min(3).max(500).optional(),
  city: z.string().trim().min(2).max(120).optional(),
  state: z.string().trim().min(2).max(120).optional(),
  postalCode: z.string().trim().min(3).max(20).optional(),
  accuracyMeters: z.coerce.number().min(0).max(100000).optional()
});

const statusSchema = z
  .object({
    onlineStatus: z.boolean(),
    availabilityStatus: z.enum(["AVAILABLE", "BUSY", "OFFLINE"]),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    accuracyMeters: z.coerce.number().min(0).max(100000).optional(),
  })
  .superRefine((data, context) => {
    if (!data.onlineStatus) {
      return;
    }

    if (data.latitude === undefined || data.longitude === undefined) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Current location is required before going online.",
      });
    }
  });

export async function getNearbyWorkers(request, response) {
  const validation = nearbySchema.safeParse(request.query);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message: "Provide service, latitude, longitude, and a radius from 1 to 20 km."
    });
  }

  const { service, latitude, longitude, radius } = validation.data;
  const radiusMeters = radius * 1000;

  // Capture and save customer's live device GPS if authenticated
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      if (payload && payload.sub) {
        await pool.query(
          `
            UPDATE customers
            SET current_location = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                updated_at = NOW()
            WHERE user_id = $3
          `,
          [latitude, longitude, payload.sub]
        );

        recordAuditLog({
          userId: payload.sub,
          userEmail: payload.email,
          action: "CUSTOMER_GPS_SEARCH",
          threatCategory: "R",
          details: { service, radius, latitude, longitude },
          ipAddress: request.ip,
          upsert: true
        });
      }
    } catch {
      // Non-blocking if guest or expired token
    }
  }

  try {
    const result = await pool.query(
      `
        SELECT
          w.user_id AS id,
          u.name,
          sc.id AS service_category_id,
          sc.name AS service,
          ws.minimum_charge AS minimum_charge,
          w.average_rating AS rating,
          w.total_reviews,
          w.city,

          ROUND(
            (
              ST_Distance(
                w.current_location,
                ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
              ) / 1000
            )::numeric,
            2
          ) AS distance_km,

          ROUND(ST_Y(w.current_location::geometry)::numeric, 6) AS latitude,
          ROUND(ST_X(w.current_location::geometry)::numeric, 6) AS longitude

        FROM workers w
        JOIN users u ON u.id = w.user_id
        JOIN worker_services ws
          ON ws.worker_id = w.user_id
          AND ws.is_active = TRUE
        JOIN service_categories sc ON sc.id = ws.service_category_id

        WHERE LOWER(sc.name) = LOWER($3)
          AND w.verification_status = 'APPROVED'
          AND w.online_status = TRUE
          AND w.availability_status = 'AVAILABLE'
          AND w.current_location IS NOT NULL
          AND ST_DWithin(
            w.current_location,
            ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
            $4
          )

        ORDER BY distance_km ASC
      `,
      [latitude, longitude, service, radiusMeters]
    );

    response.json({
      success: true,
      radius,
      workers: result.rows.map((worker) => ({
        id: worker.id,
        name: worker.name,
        serviceCategoryId: worker.service_category_id,
        service: worker.service,
        distanceKm: Number(worker.distance_km),
        rating: Number(worker.rating),
        totalReviews: worker.total_reviews,
        minimumCharge: Number(worker.minimum_charge),
        city: worker.city,
        isOnline: true,
        isAvailable: true,
        latitude: Number(worker.latitude),
        longitude: Number(worker.longitude)
      }))
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      success: false,
      message: "Could not search for nearby workers."
    });
  }
}

export async function getMyWorkerProfile(request, response) {
  try {
    const result = await pool.query(
      `
        SELECT
          u.id,
          u.name,
          u.email,
          u.phone,
          w.description,
          w.experience_years,
          w.verification_status,
          w.average_rating,
          w.total_reviews,
          w.online_status,
          w.availability_status,
          w.address,
          w.city,
          w.state,
          w.postal_code,
          ST_Y(w.current_location::geometry) AS latitude,
          ST_X(w.current_location::geometry) AS longitude
        FROM users u
        JOIN workers w ON w.user_id = u.id
        WHERE u.id = $1
      `,
      [request.user.sub]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({
        success: false,
        message: "Worker profile was not found."
      });
    }

    const worker = result.rows[0];

    response.json({
      success: true,
      worker: {
        id: worker.id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        description: worker.description,
        experienceYears: worker.experience_years,
        verificationStatus: worker.verification_status,
        rating: Number(worker.average_rating),
        totalReviews: worker.total_reviews,
        onlineStatus: worker.online_status,
        availabilityStatus: worker.availability_status,
        address: worker.address,
        city: worker.city,
        state: worker.state,
        postalCode: worker.postal_code,
        latitude: worker.latitude === null ? null : Number(worker.latitude),
        longitude: worker.longitude === null ? null : Number(worker.longitude),
      },
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      success: false,
      message: "Could not load worker profile."
    });
  }
}

export async function updateMyLocation(request, response) {
  const validation = locationSchema.safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message: "A valid latitude and longitude are required."
    });
  }

  const data = validation.data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const workerResult = await client.query(
      `
        UPDATE workers
        SET
          current_location =
            ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
          address = COALESCE($4, address),
          city = COALESCE($5, city),
          state = COALESCE($6, state),
          postal_code = COALESCE($7, postal_code),
          last_location_updated_at = NOW()
        WHERE user_id = $1
        RETURNING user_id
      `,
      [
        request.user.sub,
        data.latitude,
        data.longitude,
        data.address || null,
        data.city || null,
        data.state || null,
        data.postalCode || null
      ]
    );

    if (workerResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return response.status(404).json({
        success: false,
        message: "Worker profile was not found."
      });
    }

    await client.query(
      `
        INSERT INTO worker_locations (
          worker_id,
          location,
          accuracy_meters
        )
        VALUES (
          $1,
          ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
          $4
        )
      `,
      [
        request.user.sub,
        data.latitude,
        data.longitude,
        data.accuracyMeters || null
      ]
    );

    await client.query("COMMIT");

    recordAuditLog({
      userId: request.user.sub,
      userEmail: request.user.email,
      action: "WORKER_GPS_LOCATION",
      threatCategory: "R",
      details: {
        role: "WORKER",
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address || null,
        city: data.city || null
      },
      ipAddress: request.ip,
      upsert: true
    });

    response.json({
      success: true,
      message: "Worker location updated."
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    response.status(500).json({
      success: false,
      message: "Could not update worker location."
    });
  } finally {
    client.release();
  }
}

export async function updateMyStatus(request, response) {
  const validation = statusSchema.safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message: validation.error.issues[0]?.message || "Provide onlineStatus and availabilityStatus."
    });
  }

  const { onlineStatus, availabilityStatus, latitude, longitude, accuracyMeters } = validation.data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        UPDATE workers
        SET
          online_status = $2,
          availability_status =
            CASE
              WHEN $2 = FALSE THEN 'OFFLINE'::availability_status
              ELSE $3::availability_status
            END,
          current_location = CASE
            WHEN $2 = TRUE THEN ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography
            ELSE current_location
          END,
          last_location_updated_at = CASE
            WHEN $2 = TRUE THEN NOW()
            ELSE last_location_updated_at
          END
        WHERE user_id = $1
          AND verification_status = 'APPROVED'
        RETURNING online_status, availability_status, last_location_updated_at
      `,
      [request.user.sub, onlineStatus, availabilityStatus, latitude ?? null, longitude ?? null]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return response.status(404).json({
        success: false,
        message: "Worker profile was not found."
      });
    }

    if (onlineStatus) {
      await client.query(
        `
          INSERT INTO worker_locations (worker_id, location, accuracy_meters)
          VALUES (
            $1,
            ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
            $4
          )
        `,
        [request.user.sub, latitude, longitude, accuracyMeters || null]
      );
    }

    await client.query("COMMIT");

    if (onlineStatus && latitude && longitude) {
      recordAuditLog({
        userId: request.user.sub,
        userEmail: request.user.email,
        action: "WORKER_GPS_LOCATION",
        threatCategory: "R",
        details: {
          role: "WORKER",
          onlineStatus,
          availabilityStatus,
          latitude,
          longitude
        },
        ipAddress: request.ip,
        upsert: true
      });
    }

    response.json({
      success: true,
      message: onlineStatus
        ? "You are online with your current location."
        : "You are now offline.",
      status: result.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    response.status(500).json({
      success: false,
      message: "Could not update worker status."
    });
  } finally {
    client.release();
  }
}
