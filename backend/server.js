import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { body, validationResult } from "express-validator";

dotenv.config();

const {
  PORT = 4000,
  NODE_ENV = "development",
  CORS_ORIGINS = "http://localhost:3000",
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  MAIL_TO,
  MAIL_FROM,
} = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !MAIL_TO || !MAIL_FROM) {
  console.error("❌ Missing required env vars. Check your .env file.");
  process.exit(1);
}

const app = express();

/* ---------- Security / CORS / JSON parsing ---------- */
app.use(helmet());
const allowed = CORS_ORIGINS.split(",").map((s) => s.trim());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error("CORS not allowed"), false);
    },
    methods: ["POST", "OPTIONS"],
  })
);
app.use(express.json({ limit: "200kb" }));

/* ---------- Rate limit to reduce spam ---------- */
app.use(
  "/api/contact",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
  })
);

/* ---------- Nodemailer transport ---------- */
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: String(SMTP_SECURE).toLowerCase() === "true",
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

/* ---------- Helpers ---------- */
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- Routes ---------- */
app.post(
  "/api/contact",
  [
    body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("subject").trim().isLength({ min: 2, max: 150 }).withMessage("Subject is required"),
    body("message").trim().isLength({ min: 5, max: 5000 }).withMessage("Message is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, errors: errors.array() });
    }

    const { name, email, subject, message } = req.body;

    const text = `
New message from your portfolio:

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
`.trim();

    const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <h2>New portfolio contact</h2>
  <p><strong>Name:</strong> ${escapeHtml(name)}</p>
  <p><strong>Email:</strong> ${escapeHtml(email)}</p>
  <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
  <p><strong>Message:</strong></p>
  <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message)}</pre>
</div>`.trim();

    try {
      await transporter.sendMail({
        from: MAIL_FROM,
        to: MAIL_TO,
        replyTo: email,
        subject: `📫 Portfolio Contact: ${subject}`,
        text,
        html,
      });

      return res.json({ ok: true, message: "Sent" });
    } catch (err) {
  console.error("Email send error:", err.response || err.message || err);
  return res.status(500).json({ ok: false, message: "Failed to send email" });
}

  }
);

app.get("/api/health", (_req, res) => res.json({ ok: true, env: NODE_ENV }));

app.listen(PORT, () => {
  console.log(`✅ Contact backend listening on http://localhost:${PORT}`);
});
