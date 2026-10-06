import { pool } from "../config/db.js";

export async function getServices(request, response) {
  try {
    const result = await pool.query(`
      SELECT id, name, description, icon
      FROM service_categories
      WHERE is_active = TRUE
      ORDER BY name ASC
    `);

    response.json({
      success: true,
      services: result.rows
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      success: false,
      message: "Could not load service categories."
    });
  }
}