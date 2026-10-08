import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

export async function authenticate(request, response, next) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return response.status(401).json({
      success: false,
      message: "Authentication token is required."
    });
  }

  try {
    const token = authorization.slice(7);

    const payload = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET
    );

    // Verify account is active and not permanently blocked by Admin
    const userResult = await pool.query(
      "SELECT id, is_active, blocked_reason FROM users WHERE id = $1",
      [payload.sub]
    );

    if (userResult.rowCount === 0 || !userResult.rows[0].is_active) {
      const reason = userResult.rows[0]?.blocked_reason || "unusual activity detected";
      return response.status(403).json({
        success: false,
        isBlocked: true,
        message: `Your account has been permanently blocked by the security administrator due to: ${reason}`
      });
    }

    request.user = payload;
    next();
  } catch {
    response.status(401).json({
      success: false,
      message: "Your session is invalid or expired."
    });
  }
}

export function allowRoles(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.user.role)) {
      return response.status(403).json({
        success: false,
        message: "You do not have permission for this action."
      });
    }

    next();
  };
}