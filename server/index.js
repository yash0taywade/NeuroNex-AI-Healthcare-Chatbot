// server/index.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import fetch from "node-fetch"; // make sure node-fetch is installed or use global fetch in newer node
import { db } from "./db.js"; // your existing db helper (mysql2/promise)
import { GoogleAuth } from "google-auth-library";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

// ---------------- Gemini / Generative Language config ----------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const USE_OAUTH = (process.env.USE_OAUTH === "1" || process.env.USE_OAUTH === "true") || false;

// GoogleAuth helper for service account OAuth
const googleAuth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

async function getAccessTokenFromServiceAccount() {
  try {
    const client = await googleAuth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse?.token || tokenResponse;
    if (!accessToken) {
      console.warn("getAccessTokenFromServiceAccount: no token returned");
      return null;
    }
    return accessToken;
  } catch (e) {
    console.error("getAccessTokenFromServiceAccount failed:", e && (e.stack || e.message));
    return null;
  }
}

// helper POST with fetch, returning raw text result
async function tryPost(url, body, headers = {}) {
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const raw = await resp.text();
    return { ok: resp.ok, status: resp.status, raw };
  } catch (e) {
    return { ok: false, status: 0, raw: String(e) };
  }
}

// ---------- Gemini via API key ----------
async function callGeminiWithApiKey(userPrompt) {
  if (!GEMINI_API_KEY) return null;
  const model = encodeURIComponent(GEMINI_MODEL);
  const base = `https://generativelanguage.googleapis.com/v1beta/models/${model}`;

  // try generateText (modern), fallback to generateContent
  let res = await tryPost(`${base}:generateText?key=${GEMINI_API_KEY}`, {
    prompt: { text: userPrompt },
    temperature: 0.25,
    maxOutputTokens: 400,
  });

  if (!res.ok && res.status === 404) {
    // fallback to generateContent shape
    res = await tryPost(`${base}:generateContent?key=${GEMINI_API_KEY}`, {
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });
  }

  if (!res.ok) {
    console.error("Gemini API (API key) error", res.status, res.raw);
    return null;
  }

  try {
    const data = JSON.parse(res.raw);
    const textReply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content?.[0]?.text ||
      data?.candidates?.[0]?.output ||
      data?.output ||
      data?.text ||
      JSON.stringify(data);
    return textReply;
  } catch (e) {
    console.error("callGeminiWithApiKey parse error:", e && e.message);
    return res.raw;
  }
}

// ---------- Gemini via OAuth service account ----------
async function callGeminiWithOAuth(userPrompt) {
  try {
    const token = await getAccessTokenFromServiceAccount();
    if (!token) return null;
    const model = encodeURIComponent(GEMINI_MODEL);
    const base = `https://generativelanguage.googleapis.com/v1beta/models/${model}`;

    let res = await tryPost(`${base}:generateText`, {
      prompt: { text: userPrompt },
      temperature: 0.25,
      maxOutputTokens: 400,
    }, { Authorization: `Bearer ${token}` });

    if (!res.ok && res.status === 404) {
      // fallback to generateContent
      res = await tryPost(`${base}:generateContent`, {
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      }, { Authorization: `Bearer ${token}` });
    }

    if (!res.ok) {
      console.error("Gemini OAuth API error", res.status, res.raw);
      return null;
    }

    const data = JSON.parse(res.raw);
    const textReply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content?.[0]?.text ||
      data?.candidates?.[0]?.output ||
      data?.output ||
      data?.text ||
      JSON.stringify(data);
    return textReply;
  } catch (e) {
    console.error("callGeminiWithOAuth failed:", e && (e.stack || e.message));
    return null;
  }
}

// wrapper: try OAuth first if enabled, then API key
async function callGemini(userPrompt) {
  if (USE_OAUTH) {
    const resp = await callGeminiWithOAuth(userPrompt);
    if (resp) return resp;
    console.warn("OAuth path failed — falling back to API key");
  }
  return await callGeminiWithApiKey(userPrompt);
}

// ---------------- Local fallback (simple helpful tips) ----------------
function generateLocalReply(message, user) {
  const m = (message || "").toLowerCase();

  if (m.includes("fever") || m.includes("temperature") || m.includes("cold")) {
    return `Minor fever/cold tips:\n1. Rest and stay hydrated.\n2. Drink warm fluids and soup.\n3. Use paracetamol (educational example) if needed.\n⚠️ See a healthcare professional if fever >39°C or persists.`;
  }
  if (m.includes("cough") || m.includes("throat")) {
    return `Mild cough/throat tips:\n1. Gargle warm salted water.\n2. Honey + warm water (if non-diabetic).\n3. Steam inhalation may provide relief.\n⚠️ See a doctor if cough persists >1 week.`;
  }
  if (m.includes("headache")) {
    return `Headache tips:\n1. Rest in a quiet, dim place.\n2. Hydrate and reduce screen time.\n3. Over-the-counter analgesics like paracetamol or ibuprofen (educational example).\n⚠️ Seek immediate care for sudden severe headache.`;
  }
  if (m.includes("stomach") || m.includes("vomit") || m.includes("diarrhea") || m.includes("loose")) {
    return `Stomach upset tips:\n1. Rehydrate with ORS/clear fluids.\n2. Eat bland foods (rice, toast, banana).\n3. Avoid dairy/oily foods until better.\n⚠️ See a doctor if severe dehydration or blood in stool.`;
  }
  return `General advice:\nRest, hydrate and monitor symptoms. Avoid self-medication for severe symptoms.\n⚠️ Consult a healthcare professional for diagnosis and urgent care if needed.`;
}

// ---------------- Auth middleware ----------------
const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [payload.id]);
    if (!rows || rows.length === 0) return res.status(401).json({ error: "Invalid user" });
    req.user = rows[0];
    next();
  } catch (e) {
    console.error("Auth error:", e && (e.stack || e.message));
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ---------------- Routes ----------------

// Register
app.post("/api/register", async (req, res) => {
  const { name, email, phone, blood_group, critical_disease, disease_since, city, consent } = req.body;
  if (!email || !name) return res.status(400).json({ error: "name and email required" });
  try {
    const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length > 0) return res.status(400).json({ error: "user exists" });

    const [result] = await db.query(
      "INSERT INTO users (name,email,phone,blood_group,critical_disease,disease_since,city,consent) VALUES (?,?,?,?,?,?,?,?)",
      [name, email, phone, blood_group, critical_disease, disease_since, city, consent ? 1 : 0]
    );

    const token = jwt.sign({ id: result.insertId, email }, JWT_SECRET, { expiresIn: "30d" });
    return res.json({ token });
  } catch (err) {
    console.error("Register error:", err && (err.stack || err.message));
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email required" });
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(404).json({ error: "user not found" });
    const user = rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    return res.json({ token });
  } catch (err) {
    console.error("Login error:", err && (err.stack || err.message));
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Me
app.get("/api/me", auth, async (req, res) => {
  try {
    // return user row as-is (contains city if DB has it)
    return res.json({ user: req.user });
  } catch (err) {
    console.error("GET /api/me error:", err && (err.stack || err.message));
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Chat (improved): emergency detection + safe Gemini use
app.post("/api/chat", auth, async (req, res) => {
  try {
    const user = req.user;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    const msg = (message || "").toLowerCase();

    const emergencyKeywords = [
      "chest pain", "unconscious", "severe bleeding", "difficulty breathing",
      "severe pain", "shortness of breath", "collapse", "no pulse"
    ];
    const isEmergency = emergencyKeywords.some(k => msg.includes(k));

    if (isEmergency) {
      // Try find doctors in user's city first
      const userCity = (user.city || "").trim();
      let doctors = [];
      if (userCity) {
        const [rows] = await db.query("SELECT * FROM doctors WHERE city = ? LIMIT 10", [userCity]);
        doctors = rows;
      }
      if (!doctors || doctors.length === 0) {
        const [rows2] = await db.query("SELECT * FROM doctors LIMIT 10");
        doctors = rows2;
      }

      const docInfo = (doctors || []).map(d => ({
        name: d.name, specialty: d.specialty, phone: d.phone, address: d.address, city: d.city
      }));

      const reply = `🚨 Emergency detected. Please seek immediate in-person care or call emergency services. Nearby doctors (demo):\n` +
        docInfo.map(d => `${d.name} (${d.specialty}) — ${d.phone} — ${d.address || '-'}, ${d.city || '-'}`).join("\n");

      await db.query("INSERT INTO chat_logs (user_id,message,reply) VALUES (?,?,?)", [user.id, message, reply]);
      return res.json({ reply, emergency: true, doctors: docInfo });
    }

    // Non-emergency
    let reply = generateLocalReply(message, user);

    if (GEMINI_API_KEY || USE_OAUTH) {
      const prompt = `You are a cautious medical assistant (educational, non-prescriptive). ` +
        `User profile: name=${user.name || 'N/A'}, blood_group=${user.blood_group || 'N/A'}, critical_disease=${user.critical_disease || 'none'}, city=${user.city || 'unknown'}.\n` +
        `User message: ${message}\n\n` +
        `Task: Provide up to 5 short home-care bullet tips for mild/common problems and, if appropriate, mention general examples of over-the-counter (OTC) medicines typically used for symptom relief (e.g., 'paracetamol or ibuprofen' — examples only, DO NOT include doses or regimen). ` +
        `Do NOT prescribe or provide dosing. If symptoms may be serious or unclear, advise user to consult a healthcare professional or seek in-person care. Keep concise, empathetic tone.`;

      const gresp = await callGemini(prompt);
      if (gresp) {
        let out = (typeof gresp === "string" ? gresp : JSON.stringify(gresp));
        if (!/consult/i.test(out)) {
          out = out.trim() + "\n\n⚠️ Please consult a healthcare professional if symptoms persist or worsen.";
        }
        reply = out;
      } else {
        console.warn("Gemini failed — using local fallback reply");
      }
    }

    await db.query("INSERT INTO chat_logs (user_id,message,reply) VALUES (?,?,?)", [user.id, message, reply]);
    return res.json({ reply, emergency: false });
  } catch (err) {
    console.error("Chat error:", err && (err.stack || err.message));
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Ping
app.get("/api/ping", (req, res) => res.json({ ok: true }));

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log("GEMINI_MODEL:", GEMINI_MODEL);
  console.log("GEMINI_API_KEY present:", !!GEMINI_API_KEY);
  console.log("USE_OAUTH:", USE_OAUTH);
  if (USE_OAUTH) console.log("GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS || "(not set)");
});
