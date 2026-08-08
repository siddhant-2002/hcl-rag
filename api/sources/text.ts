import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "../lib/db";
import { authenticate } from "../lib/auth";
import { KnowledgeSourceModel, serializeSource } from "../lib/models";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await connectDB();
  const userId = await authenticate(req, res);
  if (!userId) return;

  const { name, content } = req.body as { name?: string; content?: string };
  if (!name || !content) {
    return res.status(400).json({ error: "Name and content are required." });
  }

  const cleanContent = String(content);
  const words = cleanContent.trim().split(/\s+/).filter(Boolean).length;

  try {
    const doc = await KnowledgeSourceModel.create({
      userId,
      name: name.endsWith(".txt") || name.endsWith(".md") ? name : `${name}.txt`,
      type: "text",
      content: cleanContent,
      size: Buffer.byteLength(cleanContent, "utf-8"),
      wordCount: words,
      createdAt: new Date().toISOString(),
    });
    return res.status(201).json(serializeSource(doc));
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to save text source." });
  }
}
