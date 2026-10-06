import { z } from "zod";
import { pool } from "../config/db.js";

const approvalSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

const summaryQuery = `
  SELECT
    COUNT(*)::int AS total_workers,
    COUNT(*) FILTER (WHERE verification_status = 'PENDING')::int AS pending_workers,
    COUNT(*) FILTER (WHERE verification_status = 'APPROVED')::int AS approved_workers,
    COUNT(*) FILTER (WHERE verification_status = 'REJECTED')::int AS rejected_workers
  FROM workers
`;

function workerDirectoryQuery(whereClause = "") {
  return `
    SELECT w.user_id AS id, u.name, u.email, u.phone, w.description,
      w.experience_years, w.verification_status, w.online_status, w.availability_status,
      w.created_at,
      COALESCE(array_agg(DISTINCT sc.name) FILTER (WHERE sc.name IS NOT NULL), '{}') AS services
    FROM workers w
    JOIN users u ON u.id = w.user_id
    LEFT JOIN worker_services ws ON ws.worker_id = w.user_id
    LEFT JOIN service_categories sc ON sc.id = ws.service_category_id
    ${whereClause}
    GROUP BY w.user_id, u.name, u.email, u.phone, w.description, w.experience_years,
      w.verification_status, w.online_status, w.availability_status, w.created_at
    ORDER BY w.created_at DESC
  `;
}

function directoryFilters(service, search) {
  return {
    clause: `
      WHERE ($1::text IS NULL OR EXISTS (
        SELECT 1
        FROM worker_services filter_ws
        JOIN service_categories filter_sc ON filter_sc.id = filter_ws.service_category_id
        WHERE filter_ws.worker_id = w.user_id AND filter_sc.name = $1
      ))
      AND ($2::text IS NULL OR u.name ILIKE '%' || $2 || '%' OR u.phone ILIKE '%' || $2 || '%')
    `,
    values: [service || null, search || null],
  };
}

export async function getPendingWorkers(request, response) {
  try {
    const [workersResult, summaryResult] = await Promise.all([
      pool.query(workerDirectoryQuery("WHERE w.verification_status = 'PENDING'")),
      pool.query(summaryQuery),
    ]);
    return response.json({ success: true, workers: workersResult.rows, summary: summaryResult.rows[0] });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ success: false, message: "Could not load pending workers." });
  }
}

export async function getAdminWorkers(request, response) {
  const service = String(request.query.service || "").trim();
  const search = String(request.query.search || "").trim();
  const requestedPage = Number.parseInt(request.query.page, 10);
  const requestedLimit = Number.parseInt(request.query.limit, 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 8;
  const offset = (page - 1) * limit;
  const filters = directoryFilters(service, search);

  try {
    const [workersResult, summaryResult, serviceCountsResult, totalResult] = await Promise.all([
      pool.query(`${workerDirectoryQuery(filters.clause)} LIMIT $3 OFFSET $4`, [...filters.values, limit, offset]),
      pool.query(summaryQuery),
      pool.query(`
        SELECT sc.id, sc.name, sc.icon,
          COUNT(DISTINCT ws.worker_id)::int AS total_workers,
          COUNT(DISTINCT ws.worker_id) FILTER (WHERE w.verification_status = 'PENDING')::int AS pending_workers,
          COUNT(DISTINCT ws.worker_id) FILTER (WHERE w.verification_status = 'APPROVED')::int AS approved_workers,
          COUNT(DISTINCT ws.worker_id) FILTER (WHERE w.verification_status = 'REJECTED')::int AS rejected_workers
        FROM service_categories sc
        LEFT JOIN worker_services ws ON ws.service_category_id = sc.id
        LEFT JOIN workers w ON w.user_id = ws.worker_id
        GROUP BY sc.id, sc.name, sc.icon
        ORDER BY sc.name ASC
      `),
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM workers w
        JOIN users u ON u.id = w.user_id
        ${filters.clause}
      `, filters.values),
    ]);
    return response.json({
      success: true,
      workers: workersResult.rows,
      summary: summaryResult.rows[0],
      serviceCounts: serviceCountsResult.rows,
      pagination: {
        page,
        limit,
        total: totalResult.rows[0].total,
        totalPages: Math.max(1, Math.ceil(totalResult.rows[0].total / limit)),
      },
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ success: false, message: "Could not load the worker directory." });
  }
}

export async function updateWorkerApproval(request, response) {
  const validation = approvalSchema.safeParse(request.body);
  if (!validation.success) {
    return response.status(400).json({ success: false, message: "Choose APPROVED or REJECTED." });
  }

  const status = validation.data.status;
  const allowedStatusCheck = status === "APPROVED"
    ? "verification_status = 'PENDING'"
    : "verification_status IN ('PENDING', 'APPROVED')";

  try {
    const result = await pool.query(
      `
        UPDATE workers
        SET verification_status = $2, online_status = FALSE, availability_status = 'OFFLINE'
        WHERE user_id = $1 AND ${allowedStatusCheck}
        RETURNING user_id, verification_status
      `,
      [request.params.workerId, status]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({
        success: false,
        message: status === "APPROVED"
          ? "A pending worker was not found."
          : "An active or pending worker was not found.",
      });
    }

    return response.json({
      success: true,
      message: status === "REJECTED"
        ? "Worker rejected and taken offline successfully."
        : "Worker approved successfully.",
      worker: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ success: false, message: "Could not update worker approval." });
  }
}
