import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";
import express from "express";
import multer from "multer";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: "*", // Mengizinkan semua origin
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

const port = 3000;

const upload = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const GEMINI_MODEL = "gemini-2.5-flash-lite";

// 1. Model untuk Chat Umum
const model = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  systemInstruction: "Jawab hanya menggunakan bahasa Indonesia.",
});

// 2. Model Khusus PJK Dinkes Kabupaten Tangerang
const pjkModel = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  systemInstruction: `
    Anda adalah Asisten Virtual UPT Pelayanan Jaminan Kesehatan (PJK) Dinas Kesehatan Kabupaten Tangerang.
    Fokus layanan Anda adalah membantu masyarakat terkait:
    - Reaktivasi KIS PBI JKN (BPJS Gratis dari Pemerintah) yang nonaktif.
    - Layanan PAWAREK (Pelayanan WhatsApp Reaktivasi) untuk pengaktifan via WA.
    - Penanganan pengaktifan BPJS bagi pasien tidak mampu yang dirujuk dari RS.
    - Informasi syarat Reaktivasi: SKTM (Desa/Kelurahan), KK & KTP Kabupaten Tangerang (Barcode/Dukcapil), dan Surat Rujukan RS (jika sedang dirawat).
    - Lokasi: Dinas Kesehatan Kabupaten Tangerang.
    
    Gaya bahasa: Sopan, informatif, dan membantu warga Kabupaten Tangerang.
  `,
});

app.use(express.json());

// --- ENDPOINT CHAT UMUM ---
app.post("/api/chat", async (req, res) => {
  const { conversation } = req.body;
  try {
    if (!Array.isArray(conversation))
      throw new Error("Messages must be an array!");
    const result = await model.generateContent({
      contents: conversation,
      generationConfig: { temperature: 0.9 },
    });
    const response = await result.response;
    res.status(200).json({ result: response.text() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- ENDPOINT KHUSUS PJK DINKES (Fokus Reaktivasi KIS) ---
app.post("/api/pjk-chat", async (req, res) => {
  const { conversation } = req.body;
  try {
    if (!Array.isArray(conversation))
      throw new Error("Messages must be an array!");

    // Menggunakan pjkModel yang sudah diberi instruksi khusus
    const result = await pjkModel.generateContent({
      contents: conversation,
      generationConfig: {
        temperature: 0.7, // Lebih rendah agar jawaban lebih akurat/faktual
      },
    });

    const response = await result.response;
    res.status(200).json({ result: response.text() });
  } catch (e) {
    console.error("PJK Chat Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// --- ENDPOINT MULTIMODAL (ANALISIS GAMBAR) ---
function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: { data: buffer.toString("base64"), mimeType },
  };
}

app.post("/upload-and-ask", upload.single("file"), async (req, res) => {
  try {
    const { prompt } = req.body;
    const file = req.file;
    if (!prompt)
      return res.status(400).json({ error: "Prompt teks harus diisi" });

    const contentParts = [prompt];
    if (file) {
      const filePart = fileToGenerativePart(file.buffer, file.mimetype);
      contentParts.push(filePart);
    }

    const result = await model.generateContent(contentParts);
    const response = await result.response;
    res.status(200).json({ success: true, analysis: response.text() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server nyala di port ${port}`);
  console.log(`PJK Endpoint: http://localhost:${port}/api/pjk-chat`);
});
