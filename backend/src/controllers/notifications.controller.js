import { pool } from "../config/db.js";

export async function getMyNotifications(request, response) {
  try {
    const result = await pool.query(
      `
        SELECT id, title, body, notification_type, data, is_read, created_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 20
      `,
      [request.user.sub]
    );

    return response.json({ success: true, notifications: result.rows });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ success: false, message: "Could not load notifications." });
  }
}

export async function markAllNotificationsRead(request, response) {
  try {
    await pool.query(
      `
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = $1 AND is_read = FALSE
      `,
      [request.user.sub]
    );

    return response.json({ success: true, message: "Notifications marked as read." });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ success: false, message: "Could not update notifications." });
  }
}
