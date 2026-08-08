import type { VercelRequest, VercelResponse } from "@vercel/node";
import multer from "multer";
import { connectDB } from "../lib/db";
import { authenticate } from "../lib/auth";
import { KnowledgeSourceModel, serializeSource } from "../lib/models";

// Disable Vercel's built-in body parser so multer can handle the multipart stream
export const config = {
  api: {
    bodyParser: false,
  },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

function runMiddleware(req: any, res: any, fn: any): Promise<void> {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) reject(result);
      else resolve(result);
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Run multer middleware to parse the multipart form
  try {
    await runMiddleware(req, res, upload.single("file"));
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "File upload failed." });
  }

  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(400).json({ error: "No file was uploaded." });
  }

  let textContent: string;
  try {
    textContent = file.buffer.toString("utf-8");
  } catch (_err) {
    return res.status(400).json({ error: "Could not read file as text. Please upload text-based files." });
  }

  const isBinary = /[\x00-\x08\x0E-\x1F\x7F]/.test(textContent.slice(0, 500));
  if (isBinary) {
    return res.status(400).json({
      error: "Binary file formats are not supported. Please upload plain text, Markdown, or JSON files.",
    });
  }

  const words = textContent.trim().split(/\s+/).filter(Boolean).length;

  await connectDB();
  const userId = await authenticate(req as any, res);
  if (!userId) return;

  try {
    const doc = await KnowledgeSourceModel.create({
      userId,
      name: file.originalname,
      type: "file",
      content: textContent,
      size: file.size,
      wordCount: words,
      createdAt: new Date().toISOString(),
    });
    return res.status(201).json(serializeSource(doc));
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to save file source." });
  }
}
