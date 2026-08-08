import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import { connectDB } from "../lib/db";
import { authenticate } from "../lib/auth";
import { KnowledgeSourceModel } from "../lib/models";
import { retrieveRelevantChunks } from "../lib/rag";

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" },
      },
    });
  }
  return aiClient;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await connectDB();
  const userId = await authenticate(req, res);
  if (!userId) return;

  const { message, activeSourceIds, chatHistory } = req.body as {
    message?: string;
    activeSourceIds?: string[];
    chatHistory?: Array<{ role: string; content: string }>;
  };

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  // Load active sources from MongoDB
  let activeSources: any[] = [];
  try {
    if (activeSourceIds && activeSourceIds.length > 0) {
      activeSources = await KnowledgeSourceModel.find({
        _id: { $in: activeSourceIds },
        userId,
      });
    } else {
      activeSources = await KnowledgeSourceModel.find({ userId });
    }
  } catch (dbErr: any) {
    console.error("Error loading sources for chat:", dbErr);
  }

  let contextText = "No active knowledge base sources selected or available.";
  let retrieved: ReturnType<typeof retrieveRelevantChunks> = [];

  if (activeSources.length > 0) {
    retrieved = retrieveRelevantChunks(message, activeSources, 6);
    if (retrieved.length > 0) {
      contextText = retrieved
        .map((c, i) => `[Block ${i + 1}] Source: ${c.sourceName}\nContent: ${c.text}`)
        .join("\n\n---\n\n");
    }
  }

  try {
    const gemini = getGeminiClient();

    const systemInstruction = `You are a precise, minimalist RAG (Retrieval-Augmented Generation) Chatbot.
Your UI style is "clean, white, minimalistic" and your communication must be professional, direct, and helpful.

INSTRUCTIONS:
1. Ground your answer strictly in the provided Document Context blocks below.
2. If the answer cannot be found in the Document Context, explicitly state: "Based on the provided documents, I could not find information to answer this question." Then, you can provide a helpful response using your general training knowledge, but clearly separate it by stating it is from your general knowledge.
3. Keep answers concise, scannable, and extremely polished.
4. When referring to facts from a document block, cite the document name at the end of the sentence or paragraph, e.g. [Document Name.md] or [Web: domain.com]. Do not cite block numbers, use the source document name instead.
5. If no active knowledge source was provided or none are selected, answer using your general knowledge but remind the user they can upload files in the left panel to ground the chatbot.`;

    const contents: any[] = [];

    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((msg) => {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        });
      });
    }

    const currentPrompt = `Document Context:\n${contextText}\n\n----------------------\n\nUser Query: ${message}`;
    contents.push({ role: "user", parts: [{ text: currentPrompt }] });

    const response = await gemini.models.generateContent({
      model: "gemini-2.0-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    const answer = response.text || "I was unable to generate a response.";
    const citations = retrieved.map((c) => ({
      sourceId: c.sourceId,
      sourceName: c.sourceName,
      textExcerpt: c.text,
    }));

    return res.json({ answer, citations });
  } catch (error: any) {
    console.error("Gemini API Error in /api/chat:", error);
    return res.status(500).json({
      error: error.message || "An error occurred while contacting the AI service.",
    });
  }
}
