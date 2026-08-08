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

  const { url } = req.body as { url?: string };
  if (!url) {
    return res.status(400).json({ error: "URL is required." });
  }

  try {
    let targetUrl = String(url).trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RAGChatbot/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();

    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text || text.length < 50) {
      throw new Error("Extracted text is too short or webpage is empty.");
    }

    if (text.length > 500000) {
      text = text.slice(0, 500000) + "... [Truncated for RAG]";
    }

    const parsedUrl = new URL(targetUrl);
    const domainName = parsedUrl.hostname.replace("www.", "");
    const words = text.trim().split(/\s+/).filter(Boolean).length;

    const doc = await KnowledgeSourceModel.create({
      userId,
      name: `Web: ${domainName}`,
      type: "url",
      content: text,
      size: Buffer.byteLength(text, "utf-8"),
      wordCount: words,
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json(serializeSource(doc));
  } catch (err: any) {
    console.error("Error extracting from URL:", err);
    return res.status(400).json({ error: err.message || "Failed to extract text from URL." });
  }
}
