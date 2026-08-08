import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "../../../lib/db";
import { authenticate } from "../../../lib/auth";
import { KnowledgeSourceModel, serializeSource } from "../../../lib/models";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await connectDB();
  const userId = await authenticate(req, res);
  if (!userId) return;

  const { id } = req.query as { id: string };

  try {
    const doc = await KnowledgeSourceModel.findOne({ _id: id, userId });
    if (!doc) return res.status(404).json({ error: "Source not found" });
    return res.json({ ...serializeSource(doc), content: doc.content });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch source." });
  }
}
