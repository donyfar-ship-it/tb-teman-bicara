import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
app.use(helmet());
app.use(cors()); // Batasi origin sesuai domain aplikasi saat produksi.
app.use(express.json({ limit: "32kb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.get("/health", (_req, res) => res.json({ ok: true, service: "TB backend" }));

app.post("/chat", async (req, res) => {
  try {
    if (!API_KEY || API_KEY === "MASUKKAN_API_KEY_DI_SINI") {
      return res.status(503).json({ error: "API key belum dikonfigurasi di backend." });
    }
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message || message.length > 8000) {
      return res.status(400).json({ error: "Pesan kosong atau terlalu panjang (maksimum 8000 karakter)." });
    }

    const suppliedHistory = Array.isArray(req.body?.history) ? req.body.history.slice(-16) : [];
    const contents = [];
    for (const item of suppliedHistory) {
      if (!item || !["user", "model"].includes(item.role) || typeof item.text !== "string") continue;
      contents.push({
        role: item.role,
        parts: [{ text: item.text.slice(0, 8000) }]
      });
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "Namamu TB (Teman Bicara). Kamu adalah teman bicara AI yang ramah, hangat, sopan, dan membantu. Jawab dalam bahasa Indonesia kecuali pengguna meminta bahasa lain. Untuk percakapan suara, gunakan kalimat yang jelas dan alami. Jangan mengaku sebagai manusia." }]
          },
          contents,
          generationConfig: { temperature: 0.8, maxOutputTokens: 900 }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini API error:", response.status, JSON.stringify(data).slice(0, 1200));
      return res.status(502).json({ error: "Layanan AI gagal memproses permintaan. Periksa model, kuota, dan API key." });
    }
    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) return res.status(502).json({ error: "Layanan AI mengembalikan jawaban kosong." });
    return res.json({ reply });
  } catch (error) {
    console.error("Request failed:", error?.message || error);
    return res.status(500).json({ error: "Kesalahan internal pada server TB." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TB backend berjalan pada port ${PORT}`);
  console.log(`Model AI: ${MODEL}`);
});
