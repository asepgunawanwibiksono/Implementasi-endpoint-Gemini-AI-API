import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "fs";

const app = express();
const port = 3000;

// Konfigurasi Multer (untuk menangani upload file)
// File akan disimpan sementara di memori buffer, tidak di disk
const upload = multer({ storage: multer.memoryStorage() });

// Inisialisasi Google AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gunakan model Gemini 1.5 Flash (sangat bagus untuk multimodal: gambar/audio/dokumen)
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

app.use(express.json());

/**
 * Fungsi pembantu untuk mengubah buffer file multer
 * menjadi format yang dimengerti oleh Gemini API
 */
function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  };
}

/**
 * Endpoint POST untuk upload file + prompt teks
 * URL: http://localhost:3000/upload-and-ask
 * Di Postman, gunakan Body -> form-data
 */
app.post("/upload-and-ask", upload.single("file"), async (req, res) => {
  try {
    const { prompt } = req.body; // Ambil teks prompt
    const file = req.file; // Ambil file yang diupload

    if (!prompt) {
      return res.status(400).json({ error: "Prompt teks harus diisi" });
    }

    // Array untuk menampung bagian-bagian konten (teks + file)
    const contentParts = [prompt];

    // Jika ada file yang diupload, konversi dan tambahkan ke array konten
    if (file) {
      console.log(`Menerima file: ${file.originalname} (${file.mimetype})`);
      const filePart = fileToGenerativePart(file.buffer, file.mimetype);
      contentParts.push(filePart);
    }

    console.log("Menghubungi Gemini untuk analisis multimodal...");

    // Generate konten menggunakan array yang berisi teks dan data file
    const result = await model.generateContent(contentParts);
    const response = await result.response;
    const text = response.text();

    res.status(200).json({
      success: true,
      filename: file ? file.originalname : "Tidak ada file",
      analysis: text,
    });
  } catch (error) {
    console.error("Error Multimodal:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Server nyala di port ${port}`);
  console.log(`Endpoint Multimodal: http://localhost:${port}/upload-and-ask`);
});
