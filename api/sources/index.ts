import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "../lib/db";
import { authenticate } from "../lib/auth";
import { KnowledgeSourceModel, serializeSource } from "../lib/models";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();
  const userId = await authenticate(req, res);
  if (!userId) return;

  // GET /api/sources — list all sources (metadata only)
  if (req.method === "GET") {
    try {
      const docs = await KnowledgeSourceModel.find({ userId }).sort({ createdAt: -1 });
      return res.json(docs.map(serializeSource));
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to load sources." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
