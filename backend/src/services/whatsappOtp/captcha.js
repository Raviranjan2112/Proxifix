import crypto from "node:crypto";

const CAPTCHA_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // No ambiguous 0, O, 1, I, l
const challenges = new Map();

// Periodic prune of expired challenges (5 minute TTL)
setInterval(() => {
  const now = Date.now();
  for (const [id, challenge] of challenges.entries()) {
    if (now > challenge.expiresAt) {
      challenges.delete(id);
    }
  }
}, 60000);

export function generateAlphanumericCode(length = 5) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CAPTCHA_CHARS[crypto.randomInt(0, CAPTCHA_CHARS.length)];
  }
  return result;
}

export function generateCaptchaSvg(code) {
  const width = 180;
  const height = 52;
  const colors = ["#075c31", "#15803d", "#0284c7", "#d97706", "#7c3aed", "#0f172a"];

  // Random curved noise lines
  let noiseLines = "";
  for (let i = 0; i < 4; i++) {
    const x1 = crypto.randomInt(0, 30);
    const y1 = crypto.randomInt(10, height - 10);
    const x2 = crypto.randomInt(width - 30, width);
    const y2 = crypto.randomInt(10, height - 10);
    const stroke = colors[crypto.randomInt(0, colors.length)];
    const strokeWidth = (Math.random() * 1.5 + 1).toFixed(1);
    const qx = crypto.randomInt(40, width - 40);
    const qy = crypto.randomInt(5, height - 5);
    noiseLines += `<path d="M ${x1} ${y1} Q ${qx} ${qy} ${x2} ${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" opacity="0.4"/>`;
  }

  // Random noise dots
  let noiseDots = "";
  for (let i = 0; i < 18; i++) {
    const cx = crypto.randomInt(5, width - 5);
    const cy = crypto.randomInt(5, height - 5);
    const r = (Math.random() * 1.5 + 0.8).toFixed(1);
    const fill = colors[crypto.randomInt(0, colors.length)];
    noiseDots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="0.3"/>`;
  }

  // Character distortion
  let charElements = "";
  const charSpacing = (width - 30) / code.length;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const x = 20 + i * charSpacing;
    const y = crypto.randomInt(33, 38);
    const rot = crypto.randomInt(-16, 17);
    const color = colors[i % colors.length];

    charElements += `
      <g transform="rotate(${rot} ${x} ${y})">
        <text x="${x}" y="${y}" font-family="monospace, -apple-system, sans-serif" font-size="28" font-weight="800" fill="${color}" letter-spacing="2">
          ${char}
        </text>
      </g>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#f8fafc; border-radius:8px; border:1px solid #cbd5e1; user-select:none;">
    <rect width="${width}" height="${height}" fill="#f8fafc" rx="8"/>
    ${noiseLines}
    ${noiseDots}
    ${charElements}
  </svg>`.trim();
}

export function createCaptchaChallenge() {
  const code = generateAlphanumericCode(5);
  const captchaId = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min TTL

  challenges.set(captchaId, {
    code: code.toUpperCase(),
    expiresAt,
  });

  const svg = generateCaptchaSvg(code);
  return { captchaId, svg };
}

export function verifyCaptcha(captchaId, inputCode) {
  if (!captchaId || !inputCode) {
    return { success: false, error: "CAPTCHA code is required." };
  }

  const challenge = challenges.get(captchaId);
  if (!challenge) {
    return { success: false, error: "CAPTCHA expired. Please refresh the challenge." };
  }

  // Single-use: delete immediately to prevent replay attacks
  challenges.delete(captchaId);

  if (Date.now() > challenge.expiresAt) {
    return { success: false, error: "CAPTCHA expired. Please refresh the challenge." };
  }

  const normalizedInput = String(inputCode).trim().toUpperCase();
  if (normalizedInput !== challenge.code) {
    return { success: false, error: "Incorrect CAPTCHA code. Please try again." };
  }

  return { success: true };
}
