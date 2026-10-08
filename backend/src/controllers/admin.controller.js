import { z } from "zod";
import { pool } from "../config/db.js";
import { recordAuditLog } from "../utils/auditLogger.js";

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

    recordAuditLog({
      userId: request.user.sub,
      userEmail: request.user.email,
      action: `WORKER_${status}`,
      threatCategory: "E",
      details: { workerId: request.params.workerId, newStatus: status },
      ipAddress: request.ip
    });

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

export async function getAuditLogs(request, response) {
  try {
    const result = await pool.query(
      `
        SELECT id, user_id, user_email, action, threat_category, details, ip_address, created_at
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 50
      `
    );
    return response.json({
      success: true,
      logs: result.rows
    });
  } catch (error) {
    console.error("Failed to load audit logs:", error);
    return response.status(500).json({ success: false, message: "Could not load audit logs." });
  }
}

export async function getSecurityDreadMatrix(request, response) {
  const dreadMatrix = [
    {
      category: "S (Spoofing)",
      threat: "Forging Authentication Token (JWT)",
      d: 9, r: 2, e: 2, a: 10, disc: 2,
      score: 5.0,
      riskLevel: "Medium",
      mitigation: "HMAC-SHA256 cryptographic signature with 256-bit server secret"
    },
    {
      category: "S (Spoofing)",
      threat: "Faking GPS coordinates for dispatch",
      d: 6, r: 7, e: 6, a: 4, disc: 5,
      score: 5.6,
      riskLevel: "Medium",
      mitigation: "Server-side Zod boundary assertions (lat [-90,90], lon [-180,180])"
    },
    {
      category: "T (Tampering)",
      threat: "Manipulating Booking Price in payload",
      d: 8, r: 8, e: 7, a: 8, disc: 7,
      score: 7.6,
      riskLevel: "High",
      mitigation: "Server-side authoritative pricing; client amounts ignored"
    },
    {
      category: "T (Tampering)",
      threat: "SQL Injection in spatial search filters",
      d: 10, r: 3, e: 2, a: 10, disc: 3,
      score: 5.6,
      riskLevel: "Medium",
      mitigation: "Parameterized queries ($1, $2) via pg driver; no string concatenation"
    },
    {
      category: "T (Tampering)",
      threat: "Uploading malicious script disguised as photo",
      d: 9, r: 4, e: 3, a: 10, disc: 4,
      score: 6.0,
      riskLevel: "Medium",
      mitigation: "Multer MIME validation + cryptographically random UUID filename"
    },
    {
      category: "R (Repudiation)",
      threat: "Disputing service arrival or work completion",
      d: 6, r: 6, e: 5, a: 4, disc: 5,
      score: 5.2,
      riskLevel: "Medium",
      mitigation: "Mandatory photo proof pipeline + arrived_at immutable timestamp"
    },
    {
      category: "I (Information)",
      threat: "Scraping private customer street addresses",
      d: 8, r: 7, e: 5, a: 9, disc: 6,
      score: 7.0,
      riskLevel: "High",
      mitigation: "Proximity Privacy: exact address masked until booking is accepted"
    },
    {
      category: "D (Denial of Service)",
      threat: "Flooding PostGIS with complex spatial scans",
      d: 7, r: 8, e: 7, a: 10, disc: 7,
      score: 7.8,
      riskLevel: "High",
      mitigation: "GiST 2D R-Tree spatial index + sliding rate limiter (1200 req/15min)"
    },
    {
      category: "E (Elevation)",
      threat: "Customer attempting admin action execution",
      d: 9, r: 2, e: 2, a: 10, disc: 2,
      score: 5.0,
      riskLevel: "Medium",
      mitigation: "allowRoles('ADMIN') RBAC middleware with claim verification"
    }
  ];

  return response.json({
    success: true,
    matrix: dreadMatrix
  });
}
