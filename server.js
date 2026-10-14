import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Keamanan
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiter (Maksimal 100 request per 15 menit per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Terlalu banyak permintaan, coba lagi nanti."
});
app.use(limiter);

// Konfigurasi Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Route Utama (Health Check)
app.get('/', (req, res) => {
  res.json({ status: "Server Teman Bicara (Gemini) Aktif!" });
});

// Route untuk Chat AI
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Pesan tidak boleh kosong." });
    }

    // Kirim pesan ke Gemini
    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();

    res.json({ reply: text });
  } catch (error) {
    console.error("Error Gemini:", error);
    res.status(500).json({ error: error.message });
  }
});

// Jalankan Server
app.listen(PORT, () => {
  console.log(`Server Teman Bicara berjalan di port ${PORT}`);
});
