import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../config/db.js";
import { recordAuditLog } from "../utils/auditLogger.js";

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255),
    phone: z
      .string()
      .trim()
      .regex(
        /^\+[1-9]\d{7,14}$/,
        "Use mobile number with country code, for example +919876543210."
      ),
    password: z.string().min(8).max(100),
    role: z.enum(["CUSTOMER", "WORKER"]),

    address: z.string().trim().max(500).optional(),
    city: z.string().trim().max(120).optional(),
    state: z.string().trim().max(120).optional(),
    postalCode: z.string().trim().max(20).optional(),

    serviceCategoryId: z.string().uuid().optional(),
    minimumCharge: z.coerce.number().min(0).optional(),
    experienceYears: z.coerce.number().int().min(0).max(70).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, context) => {
    if (data.role !== "WORKER") {
      return;
    }

    if (!data.serviceCategoryId) {
      context.addIssue({
        code: "custom",
        path: ["serviceCategoryId"],
        message: "A worker must choose a service category.",
      });
    }

    if (data.minimumCharge === undefined) {
      context.addIssue({
        code: "custom",
        path: ["minimumCharge"],
        message: "A worker must provide a minimum charge.",
      });
    }
  });

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "7d",
    }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}

export async function register(request, response) {
  const validation = registerSchema.safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message: validation.error.issues[0]?.message || "Please correct the registration details.",
      errors: validation.error.issues,
    });
  }

  const data = validation.data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingUser = await client.query(
      `
        SELECT email, phone
        FROM users
        WHERE email = $1 OR phone = $2
      `,
      [data.email.toLowerCase(), data.phone]
    );

    if (existingUser.rowCount > 0) {
      const existing = existingUser.rows[0];

      await client.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message:
          existing.email === data.email.toLowerCase()
            ? "This email address is already registered."
            : "This mobile number is already registered.",
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const userResult = await client.query(
      `
        INSERT INTO users (name, email, phone, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, email, phone, role
      `,
      [
        data.name,
        data.email.toLowerCase(),
        data.phone,
        passwordHash,
        data.role,
      ]
    );

    const user = userResult.rows[0];

    if (data.role === "CUSTOMER") {
      await client.query(
        `
          INSERT INTO customers (user_id)
          VALUES ($1)
        `,
        [user.id]
      );
    }

    if (data.role === "WORKER") {
      const categoryResult = await client.query(
        `
          SELECT id
          FROM service_categories
          WHERE id = $1 AND is_active = TRUE
        `,
        [data.serviceCategoryId]
      );

      if (categoryResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return response.status(400).json({
          success: false,
          message: "The selected service category is not valid.",
        });
      }

      await client.query(
        `
          INSERT INTO workers (
            user_id,
            description,
            experience_years,
            verification_status,
            online_status,
            availability_status
          )
          VALUES (
            $1, $2, $3, 'PENDING', FALSE, 'OFFLINE'
          )
        `,
        [
          user.id,
          data.description || null,
          data.experienceYears || 0,
        ]
      );

      await client.query(
        `
          INSERT INTO worker_services (
            worker_id,
            service_category_id,
            minimum_charge,
            experience_years
          )
          VALUES ($1, $2, $3, $4)
        `,
        [
          user.id,
          data.serviceCategoryId,
          data.minimumCharge,
          data.experienceYears || 0,
        ]
      );
    }

    await client.query("COMMIT");

    recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: "USER_REGISTERED",
      threatCategory: "S",
      details: { role: user.role, name: user.name },
      ipAddress: request.ip
    });

    return response.status(201).json({
      success: true,
      message: "Account created successfully.",
      token: createAccessToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    if (error.code === "23505") {
      return response.status(409).json({
        success: false,
        message: "This email address or mobile number is already registered.",
      });
    }

    return response.status(500).json({
      success: false,
      message: "Could not create the account.",
    });
  } finally {
    client.release();
  }
}

export async function login(request, response) {
  const validation = loginSchema.safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message: "Enter a valid email and password.",
    });
  }

  try {
    const { email, password } = validation.data;

    const result = await pool.query(
      `
        SELECT id, name, email, phone, password_hash, role, is_active
        FROM users
        WHERE email = $1
      `,
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return response.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return response.status(403).json({
        success: false,
        message: "This account has been disabled.",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return response.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: "USER_LOGIN_SUCCESS",
      threatCategory: "S",
      details: { role: user.role },
      ipAddress: request.ip
    });

    return response.json({
      success: true,
      message: "Login successful.",
      token: createAccessToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      success: false,
      message: "Could not log in.",
    });
  }
}
