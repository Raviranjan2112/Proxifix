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
      mitigation: "HMAC-SHA256 cryptographic signature with 256-bit server secret",
      currentRisk: "Low",
      score: 1.4,
      status: "SECURED"
    },
    {
      category: "S (Spoofing)",
      threat: "Faking GPS coordinates for dispatch",
      mitigation: "Server-side Zod boundary assertions (lat [-90,90], lon [-180,180])",
      currentRisk: "Low",
      score: 1.8,
      status: "SECURED"
    },
    {
      category: "T (Tampering)",
      threat: "Manipulating Booking Price in payload",
      mitigation: "Server-side authoritative pricing; client amounts ignored & excluded from schema",
      currentRisk: "Low",
      score: 1.0,
      status: "SECURED"
    },
    {
      category: "T (Tampering)",
      threat: "SQL Injection in spatial search filters",
      mitigation: "Parameterized queries ($1, $2) via pg driver; no string concatenation",
      currentRisk: "Low",
      score: 1.0,
      status: "SECURED"
    },
    {
      category: "T (Tampering)",
      threat: "Uploading malicious script disguised as photo",
      mitigation: "Multer MIME validation + cryptographically random UUID filename",
      currentRisk: "Low",
      score: 1.6,
      status: "SECURED"
    },
    {
      category: "R (Repudiation)",
      threat: "Disputing service arrival or work completion",
      mitigation: "Mandatory photo proof pipeline + arrived_at immutable timestamp",
      currentRisk: "Low",
      score: 1.6,
      status: "SECURED"
    },
    {
      category: "I (Information)",
      threat: "Scraping private customer street addresses",
      mitigation: "Proximity Privacy: exact address masked until booking is accepted",
      currentRisk: "Low",
      score: 1.8,
      status: "SECURED"
    },
    {
      category: "D (Denial of Service)",
      threat: "Flooding PostGIS with complex spatial scans",
      mitigation: "GiST 2D R-Tree spatial index + Zod radius clamp (max 20km) + sliding rate limiter",
      currentRisk: "Low",
      score: 2.0,
      status: "SECURED"
    },
    {
      category: "E (Elevation)",
      threat: "Customer attempting admin action execution",
      mitigation: "allowRoles('ADMIN') RBAC middleware with claim verification",
      currentRisk: "Low",
      score: 1.0,
      status: "SECURED"
    }
  ];

  return response.json({
    success: true,
    matrix: dreadMatrix
  });
}

const ipGeoCache = new Map();

export async function getIpTrackingDetails(request, response) {
  try {
    const rawIp = (request.query.ip || request.params.ip || "").trim();
    if (!rawIp) {
      return response.status(400).json({ success: false, message: "IP address is required" });
    }

    let ip = rawIp;
    if (ip.startsWith("::ffff:")) {
      ip = ip.replace("::ffff:", "");
    }

    // 1. Query audit_logs database for all historical events associated with this IP
    const statsResult = await pool.query(
      `
        SELECT 
          COUNT(*)::int AS total_events,
          COUNT(DISTINCT user_email)::int AS total_users,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT user_email), NULL) AS users,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT action), NULL) AS actions,
          MIN(created_at) AS first_seen,
          MAX(created_at) AS last_seen
        FROM audit_logs
        WHERE ip_address = $1 OR ip_address = $2
      `,
      [rawIp, ip]
    );

    const stats = statsResult.rows[0] || {
      total_events: 0,
      total_users: 0,
      users: [],
      actions: [],
      first_seen: null,
      last_seen: null
    };

    // 2. Identify if loopback or private subnet
    const isPrivate =
      ip === "::1" ||
      ip === "127.0.0.1" ||
      ip.startsWith("192.168.") ||
      ip.startsWith("10.") ||
      ip.startsWith("172.16.") ||
      ip.startsWith("fe80:") ||
      ip.toLowerCase().includes("localhost");

    let geoData = null;

    if (isPrivate) {
      geoData = {
        city: "Localhost Machine",
        region: "Internal Development Host",
        country: "Local Workstation",
        countryCode: "LOCAL",
        flag: "💻",
        isp: "Localhost Loopback Network Adapter",
        networkType: ip === "::1" ? "IPv6 Loopback" : "IPv4 Loopback",
        coordinates: "127.0.0.1 (Self Host)",
        threatLevel: "Low / Trusted Admin",
        isPrivate: true
      };
    } else {
      if (ipGeoCache.has(ip)) {
        geoData = ipGeoCache.get(ip);
      } else {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2500);
          const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: controller.signal });
          clearTimeout(timeout);
          const data = await res.json();
          if (data && data.success !== false) {
            geoData = {
              city: data.city || "Unknown City",
              region: data.region || "Unknown Region",
              country: data.country || "Unknown Country",
              countryCode: data.country_code || "",
              flag: data.flag?.emoji || "🌐",
              isp: data.connection?.isp || data.connection?.org || "Internet Service Provider",
              networkType: data.type || (ip.includes(":") ? "IPv6 Public" : "IPv4 Public"),
              coordinates: `${data.latitude || 0}° N, ${data.longitude || 0}° E`,
              threatLevel: "Verified Public Route",
              isPrivate: false
            };
            ipGeoCache.set(ip, geoData);
          }
        } catch (fetchErr) {
          console.warn("GeoIP lookup failed:", fetchErr.message);
        }

        if (!geoData) {
          geoData = {
            city: "Public Gateway",
            region: "Global Route",
            country: "Public Internet",
            countryCode: "NET",
            flag: "🌐",
            isp: "External ISP Gateway",
            networkType: ip.includes(":") ? "IPv6" : "IPv4",
            coordinates: "Global Gateway",
            threatLevel: "Normal",
            isPrivate: false
          };
        }
      }
    }

    // 3. Check if any user linked to this IP has registered hardware GPS coordinates
    let deviceGps = null;
    if (stats.users && stats.users.length > 0) {
      try {
        const gpsResult = await pool.query(
          `
            SELECT 
              u.email,
              u.name,
              u.role,
              COALESCE(ST_Y(w.current_location::geometry), ST_Y(c.current_location::geometry)) AS lat,
              COALESCE(ST_X(w.current_location::geometry), ST_X(c.current_location::geometry)) AS lng
            FROM users u
            LEFT JOIN workers w ON w.user_id = u.id
            LEFT JOIN customers c ON c.user_id = u.id
            WHERE u.email = ANY($1) 
              AND (w.current_location IS NOT NULL OR c.current_location IS NOT NULL)
            LIMIT 1
          `,
          [stats.users]
        );
        if (gpsResult.rows.length > 0) {
          const row = gpsResult.rows[0];
          deviceGps = {
            lat: Number(row.lat).toFixed(6),
            lng: Number(row.lng).toFixed(6),
            name: row.name,
            role: row.role,
            email: row.email,
            mapsUrl: `https://www.google.com/maps?q=${row.lat},${row.lng}`
          };
        }
      } catch (gpsErr) {
        console.warn("GPS query error:", gpsErr.message);
      }
    }

    let mapsUrl = null;
    if (deviceGps) {
      mapsUrl = deviceGps.mapsUrl;
      if (geoData) {
        geoData.coordinates = `${deviceGps.lat}° N, ${deviceGps.lng}° E (Device GPS)`;
      }
    } else if (geoData && geoData.lat && geoData.lon) {
      mapsUrl = `https://www.google.com/maps?q=${geoData.lat},${geoData.lon}`;
    }

    return response.json({
      success: true,
      ip: rawIp,
      geo: geoData,
      deviceGps,
      mapsUrl,
      stats: {
        totalEvents: stats.total_events || 0,
        totalUsers: stats.total_users || 0,
        users: stats.users || [],
        actions: stats.actions || [],
        firstSeen: stats.first_seen,
        lastSeen: stats.last_seen
      }
    });
  } catch (error) {
    console.error("Error in getIpTrackingDetails:", error);
    return response.status(500).json({ success: false, message: "Could not fetch IP tracking details" });
  }
}

