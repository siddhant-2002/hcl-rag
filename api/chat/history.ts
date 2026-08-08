import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "../lib/db";
import { authenticate } from "../lib/auth";
import { ChatSessionModel } from "../lib/models";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();
  const userId = await authenticate(req, res);
  if (!userId) return;

  // GET /api/chat/history — load chat session
  if (req.method === "GET") {
    try {
      const session = await ChatSessionModel.findOne({ userId });
      if (!session) return res.json({ messages: [] });
      return res.json({ messages: session.messages });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to load chat history." });
    }
  }

  // POST /api/chat/history — upsert messages
  if (req.method === "POST") {
    const { messages } = req.body as { messages?: any[] };
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required." });
    }
    try {
      await ChatSessionModel.findOneAndUpdate(
        { userId },
        { messages, updatedAt: new Date() },
        { upsert: true, new: true }
      );
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to save chat history." });
    }
  }

  // DELETE /api/chat/history — clear chat
  if (req.method === "DELETE") {
    try {
      await ChatSessionModel.findOneAndUpdate(
        { userId },
        { messages: [], updatedAt: new Date() },
        { upsert: true }
      );
      return res.json({ success: true, message: "Chat history cleared." });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to clear chat history." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
