import express, { Request, Response } from "express";
import path from "path";
import crypto from "crypto";
import dns from "dns";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import mongoose from "mongoose";
import { KnowledgeSource, Message } from "./src/types";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 3000;

const AUTH_USERNAME = process.env.AUTH_USERNAME || "admin";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "password";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hcl_rag";

const configuredDnsServers = (process.env.DNS_SERVERS || "8.8.8.8,8.8.4.4")
  .split(",")
  .map(server => server.trim())
  .filter(Boolean);

if (configuredDnsServers.length > 0) {
  dns.setServers(configuredDnsServers);
  console.log(`Using DNS servers: ${configuredDnsServers.join(", ")}`);
}

// Connect to MongoDB
let isMongoConnected = false;
mongoose.connect(MONGODB_URI)
  .then(() => {
    isMongoConnected = true;
    console.log(`Connected to MongoDB successfully at ${MONGODB_URI}`);
  })
  .catch((err) => {
    console.warn(`MongoDB Connection Warning: ${err.message}`);
    console.warn("Check Atlas network access / IP allowlist and the MongoDB connection string.");
  });

interface IUser {
  username: string;
  email: string;
  password: string;
  securityQuestion?: string;
  securityAnswer?: string;
  resetCode?: string | null;
  resetToken?: string | null;
  resetTokenExpiry?: Date | null;
  createdAt?: Date;
}

const UserSchema = new mongoose.Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  securityQuestion: { type: String, default: "What is your secret word?" },
  securityAnswer: { type: String, default: "" },
  resetCode: { type: String, default: null },
  resetToken: { type: String, default: null },
  resetTokenExpiry: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

const User = (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>("User", UserSchema);

// --- KnowledgeSource ---
interface IKnowledgeSource {
  userId: string;
  name: string;
  type: "file" | "url" | "text";
  content: string;
  size: number;
  wordCount: number;
  createdAt: string;
}

const KnowledgeSourceSchema = new mongoose.Schema<IKnowledgeSource>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ["file", "url", "text"], required: true },
  content: { type: String, required: true },
  size: { type: Number, default: 0 },
  wordCount: { type: Number, default: 0 },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const KnowledgeSourceModel =
  (mongoose.models.KnowledgeSource as mongoose.Model<IKnowledgeSource>) ||
  mongoose.model<IKnowledgeSource>("KnowledgeSource", KnowledgeSourceSchema);

// --- ChatSession ---
interface IChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
  citations?: Array<{ sourceId: string; sourceName: string; textExcerpt: string }>;
}

interface IChatSession {
  userId: string;
  messages: IChatMessage[];
  updatedAt: Date;
}

const ChatSessionSchema = new mongoose.Schema<IChatSession>({
  userId: { type: String, required: true, unique: true, index: true },
  messages: [
    {
      id: { type: String, required: true },
      role: { type: String, enum: ["user", "model"], required: true },
      content: { type: String, required: true },
      timestamp: { type: String, default: "" },
      citations: [
        {
          sourceId: String,
          sourceName: String,
          textExcerpt: String,
        },
      ],
    },
  ],
  updatedAt: { type: Date, default: Date.now },
});

const ChatSessionModel =
  (mongoose.models.ChatSession as mongoose.Model<IChatSession>) ||
  mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);



// Middleware
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Configure multer for memory storage uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Initialize Gemini Client safely
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined in the environment.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}


/* ==========================================================================
   RAG HELPERS
   ========================================================================== */

interface Chunk {
  id: string;
  sourceId: string;
  sourceName: string;
  text: string;
}

// Works with plain KnowledgeSource objects or MongoDB documents
function chunkSource(source: any): Chunk[] {
  const paragraphs = source.content.split(/\n\s*\n+/);
  const chunks: Chunk[] = [];
  let chunkCounter = 0;
  // Support both id (plain) and _id (Mongoose doc)
  const sourceId = source._id ? source._id.toString() : source.id;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (trimmed.length <= 800) {
      chunks.push({
        id: `${sourceId}-${chunkCounter++}`,
        sourceId,
        sourceName: source.name,
        text: trimmed,
      });
    } else {
      const sentences = trimmed.split(/(?<=[.!?])\s+/);
      let currentSegment = "";

      for (const sentence of sentences) {
        if ((currentSegment + " " + sentence).length > 800) {
          if (currentSegment.trim()) {
            chunks.push({
              id: `${sourceId}-${chunkCounter++}`,
              sourceId,
              sourceName: source.name,
              text: currentSegment.trim(),
            });
          }
          const words = currentSegment.split(" ");
          currentSegment = words.slice(-12).join(" ") + " " + sentence;
        } else {
          currentSegment = currentSegment ? currentSegment + " " + sentence : sentence;
        }
      }
      if (currentSegment.trim()) {
        chunks.push({
          id: `${sourceId}-${chunkCounter++}`,
          sourceId,
          sourceName: source.name,
          text: currentSegment.trim(),
        });
      }
    }
  }
  return chunks;
}

// Stop words list to improve term-matching accuracy
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "when", "at", "from", "by", "for", "with", "about", "against",
  "between", "into", "through", "during", "before", "after", "above", "below", "to", "in", "on", "of", "is", "am", "are",
  "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "i", "you", "he", "she",
  "it", "we", "they", "what", "which", "who", "whom", "this", "that", "these", "those", "as", "until", "while", "of", "at",
  "can", "could", "will", "would", "should", "how", "why", "where", "here", "there"
]);

// TF-IDF inspired local semantic keyword retriever
function retrieveRelevantChunks(query: string, sources: any[], limit = 6): Chunk[] {
  const allChunks: Chunk[] = [];
  for (const source of sources) {
    allChunks.push(...chunkSource(source));
  }

  if (allChunks.length === 0) return [];

  // Parse query terms
  const terms = query.toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));

  if (terms.length === 0) {
    // If query has only stop words, use words of length > 2
    const fallbacks = query.toLowerCase().replace(/[^\w\s-]/g, " ").split(/\s+/).filter(t => t.length > 2);
    if (fallbacks.length === 0) {
      // Fallback: Return first few chunks
      return allChunks.slice(0, limit);
    }
    terms.push(...fallbacks);
  }

  // Score each chunk
  const scoredChunks = allChunks.map(chunk => {
    const chunkTextLower = chunk.text.toLowerCase();
    let score = 0;

    terms.forEach(term => {
      // Reward exact word boundary matches
      const wordRegex = new RegExp("\\b" + term + "\\b", "g");
      const wordMatches = chunkTextLower.match(wordRegex);
      if (wordMatches) {
        score += wordMatches.length * 4; // High weight for exact word matches
      } else if (chunkTextLower.includes(term)) {
        score += 0.8; // Smaller weight for substring matches
      }
    });

    return { chunk, score };
  });

  // Filter out chunks with zero score, sort descending, and return top limits
  const filtered = scoredChunks.filter(item => item.score > 0);
  
  // If nothing matched, fallback to returning first few chunks of active sources
  if (filtered.length === 0) {
    return allChunks.slice(0, Math.min(3, allChunks.length));
  }

  return filtered
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.chunk);
}

/* ==========================================================================
   AUTH MIDDLEWARE
   ========================================================================== */

// Extend Request to carry userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: IUser & { _id?: any };
    }
  }
}

const requireAuth = async (req: Request, res: Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [username, password] = decoded.split(":");

    if (isMongoConnected) {
      const user = await User.findOne({ username });
      if (user && user.password === password) {
        req.user = user as any;
        req.userId = (user as any)._id.toString();
        return next();
      }
    }

    // Fallback admin credentials — use a stable string as userId
    if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
      req.userId = `admin:${AUTH_USERNAME}`;
      return next();
    }

    return res.status(401).json({ error: "Unauthorized" });
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

/* ==========================================================================
   AUTH ENDPOINTS (Public)
   ========================================================================== */

// 0. POST /api/login - Public, MongoDB authenticated
app.post("/api/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    if (isMongoConnected) {
      const user = await User.findOne({ 
        $or: [
          { username: username.trim() }, 
          { email: username.trim().toLowerCase() }
        ] 
      });

      if (user && user.password === password) {
        const token = Buffer.from(`${user.username}:${password}`).toString('base64');
        return res.json({ 
          success: true, 
          token, 
          user: { username: user.username, email: user.email } 
        });
      }
    }

    // Default admin environment credentials fallback
    if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
      const token = Buffer.from(`${username}:${password}`).toString('base64');
      return res.json({ 
        success: true, 
        token, 
        user: { username, email: "admin@example.com" } 
      });
    }

    return res.status(401).json({ error: "Invalid username or password" });
  } catch (err: any) {
    console.error("Login Error:", err);
    return res.status(500).json({ error: "An error occurred during login" });
  }
});

// 0.1 POST /api/signup - Create new account in MongoDB
app.post("/api/signup", async (req: Request, res: Response) => {
  const { username, email, password, securityQuestion, securityAnswer } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are required." });
  }

  try {
    if (!isMongoConnected) {
      return res.status(503).json({
        error: "MongoDB connection is offline or not reachable from this machine. Check Atlas IP allowlist and MONGODB_URI."
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [
        { username: cleanUsername },
        { email: cleanEmail }
      ]
    });

    if (existingUser) {
      if (existingUser.username === cleanUsername) {
        return res.status(400).json({ error: "Username is already registered." });
      }
      return res.status(400).json({ error: "Email is already registered." });
    }

    const newUser = new User({
      username: cleanUsername,
      email: cleanEmail,
      password,
      securityQuestion: securityQuestion || "What is your secret word?",
      securityAnswer: securityAnswer ? securityAnswer.trim().toLowerCase() : "",
    });

    await newUser.save();

    const token = Buffer.from(`${newUser.username}:${password}`).toString('base64');
    return res.status(201).json({
      success: true,
      message: "Account created successfully!",
      token,
      user: { username: newUser.username, email: newUser.email }
    });
  } catch (err: any) {
    console.error("Signup Error:", err);
    return res.status(500).json({ error: err.message || "Failed to create user account." });
  }
});

// 0.2 POST /api/forgot-password/send-link - Generate secure email reset link & store token in MongoDB
app.post("/api/forgot-password/send-link", async (req: Request, res: Response) => {
  const { usernameOrEmail } = req.body;

  if (!usernameOrEmail) {
    return res.status(400).json({ error: "Please enter your registered username or email." });
  }

  try {
    if (!isMongoConnected) {
      return res.status(503).json({ 
        error: "MongoDB connection is offline. Please check MONGODB_URI in .env." 
      });
    }

    const query = usernameOrEmail.trim();
    const user = await User.findOne({
      $or: [
        { username: query },
        { email: query.toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: "No account found with that username or email." });
    }

    // Generate secure crypto reset token & 15-minute expiration
    const resetToken = crypto.randomBytes(24).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    // Construct the reset link
    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol || "http";
    const resetLink = `${protocol}://${host}/?resetToken=${resetToken}`;

    console.log(`[AUTH] Password reset link for ${user.email}: ${resetLink}`);

    return res.json({
      success: true,
      message: `Password reset link sent to ${user.email}`,
      email: user.email,
      username: user.username,
      resetLink,
    });
  } catch (err: any) {
    console.error("Send Reset Link Error:", err);
    return res.status(500).json({ error: "Failed to generate password reset link." });
  }
});

// 0.3 GET /api/forgot-password/verify-token - Verify token from reset link
app.get("/api/forgot-password/verify-token", async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Reset token is required." });
  }

  try {
    if (!isMongoConnected) {
      return res.status(503).json({ error: "MongoDB connection is offline." });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: "This password reset link is invalid or has expired. Please request a new link." });
    }

    return res.json({
      success: true,
      username: user.username,
      email: user.email,
    });
  } catch (err: any) {
    console.error("Verify Token Error:", err);
    return res.status(500).json({ error: "Failed to verify reset token." });
  }
});

// 0.4 POST /api/forgot-password/reset-with-token - Save new password using verified token
app.post("/api/forgot-password/reset-with-token", async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: "Reset token and new password are required." });
  }

  try {
    if (!isMongoConnected) {
      return res.status(503).json({ error: "MongoDB connection is offline." });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: "This password reset token is invalid or has expired." });
    }

    // Save new password & clear token
    user.password = newPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    return res.json({
      success: true,
      message: "Password reset successfully! You can now log in with your new password.",
      username: user.username
    });
  } catch (err: any) {
    console.error("Reset With Token Error:", err);
    return res.status(500).json({ error: "Failed to reset password." });
  }
});

// Legacy backward compatibility endpoint
app.post("/api/forgot-password/request", async (req: Request, res: Response) => {
  const { usernameOrEmail } = req.body;
  if (!usernameOrEmail) return res.status(400).json({ error: "Username or email is required" });
  try {
    const user = await User.findOne({ $or: [{ username: usernameOrEmail.trim() }, { email: usernameOrEmail.trim().toLowerCase() }] });
    if (!user) return res.status(404).json({ error: "Account not found" });
    const resetToken = crypto.randomBytes(24).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    const host = req.get("host") || "localhost:3000";
    const resetLink = `${req.protocol}://${host}/?resetToken=${resetToken}`;
    res.json({ success: true, message: `Reset link sent to ${user.email}`, resetLink, email: user.email, username: user.username });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});



/* ==========================================================================
   KNOWLEDGE SOURCE ENDPOINTS (Protected — MongoDB)
   ========================================================================== */

// Helper: serialize a Mongoose KnowledgeSource doc to API shape
function serializeSource(doc: any) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    type: doc.type,
    size: doc.size,
    wordCount: doc.wordCount,
    createdAt: doc.createdAt,
  };
}

// 1. GET /api/sources — list all sources for user (metadata only)
app.get("/api/sources", requireAuth, async (req: Request, res: Response) => {
  try {
    const docs = await KnowledgeSourceModel.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(docs.map(serializeSource));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load sources." });
  }
});

// 2. GET /api/sources/:id — get single source with full content
app.get("/api/sources/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const doc = await KnowledgeSourceModel.findOne({ _id: req.params.id, userId: req.userId });
    if (!doc) return res.status(404).json({ error: "Source not found" });
    res.json({ ...serializeSource(doc), content: doc.content });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch source." });
  }
});

// 3. GET /api/sources/:id/content — alias for full content
app.get("/api/sources/:id/content", requireAuth, async (req: Request, res: Response) => {
  try {
    const doc = await KnowledgeSourceModel.findOne({ _id: req.params.id, userId: req.userId });
    if (!doc) return res.status(404).json({ error: "Source not found" });
    res.json({ ...serializeSource(doc), content: doc.content });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch source." });
  }
});

// 4. POST /api/sources/text — save pasted text
app.post("/api/sources/text", requireAuth, async (req: Request, res: Response) => {
  const { name, content } = req.body;
  if (!name || !content) {
    return res.status(400).json({ error: "Name and content are required." });
  }

  const cleanContent = String(content);
  const words = cleanContent.trim().split(/\s+/).filter(Boolean).length;

  try {
    const doc = await KnowledgeSourceModel.create({
      userId: req.userId,
      name: name.endsWith(".txt") || name.endsWith(".md") ? name : `${name}.txt`,
      type: "text",
      content: cleanContent,
      size: Buffer.byteLength(cleanContent, "utf-8"),
      wordCount: words,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(serializeSource(doc));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save text source." });
  }
});

// 5. POST /api/sources/file — upload text file
app.post("/api/sources/file", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file was uploaded." });
  }

  const fileName = req.file.originalname;
  let textContent = "";

  try {
    textContent = req.file.buffer.toString("utf-8");
  } catch (err) {
    return res.status(400).json({ error: "Could not read file as text. Please upload text-based files." });
  }

  const isBinary = /[\x00-\x08\x0E-\x1F\x7F]/.test(textContent.slice(0, 500));
  if (isBinary) {
    return res.status(400).json({ error: "Binary file formats are not supported. Please upload plain text, Markdown, or JSON files." });
  }

  const words = textContent.trim().split(/\s+/).filter(Boolean).length;

  try {
    const doc = await KnowledgeSourceModel.create({
      userId: req.userId,
      name: fileName,
      type: "file",
      content: textContent,
      size: req.file.size,
      wordCount: words,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(serializeSource(doc));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save file source." });
  }
});

// 4. POST /api/sources/url - Fetch text from a public URL
app.post("/api/sources/url", requireAuth, async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required." });
  }

  try {
    let targetUrl = String(url).trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }

    const response = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RAGChatbot/1.0" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Advanced HTML Text Extraction (Strips scripts, styles, and extracts readable text)
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text || text.length < 50) {
      throw new Error("Extracted text is too short or webpage is empty.");
    }

    // Limit extreme lengths to 500k characters for safety
    if (text.length > 500000) {
      text = text.slice(0, 500000) + "... [Truncated for RAG]";
    }

    const parsedUrl = new URL(targetUrl);
    const domainName = parsedUrl.hostname.replace("www.", "");
    const words = text.trim().split(/\s+/).filter(Boolean).length;

    const doc = await KnowledgeSourceModel.create({
      userId: req.userId,
      name: `Web: ${domainName}`,
      type: "url",
      content: text,
      size: Buffer.byteLength(text, "utf-8"),
      wordCount: words,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(serializeSource(doc));
  } catch (err: any) {
    console.error("Error extracting from URL:", err);
    res.status(400).json({ error: err.message || "Failed to extract text from URL." });
  }
});

// 6. DELETE /api/sources/:id
app.delete("/api/sources/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await KnowledgeSourceModel.deleteOne({ _id: req.params.id, userId: req.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Source not found." });
    }
    res.json({ success: true, message: "Source deleted successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete source." });
  }
});

/* ==========================================================================
   CHAT HISTORY ENDPOINTS (Protected — MongoDB)
   ========================================================================== */

// GET /api/chat/history — load saved chat session for this user
app.get("/api/chat/history", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await ChatSessionModel.findOne({ userId: req.userId });
    if (!session) return res.json({ messages: [] });
    res.json({ messages: session.messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load chat history." });
  }
});

// POST /api/chat/history — upsert entire messages array for this user
app.post("/api/chat/history", requireAuth, async (req: Request, res: Response) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required." });
  }
  try {
    await ChatSessionModel.findOneAndUpdate(
      { userId: req.userId },
      { messages, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save chat history." });
  }
});

// DELETE /api/chat/history — clear chat for this user
app.delete("/api/chat/history", requireAuth, async (req: Request, res: Response) => {
  try {
    await ChatSessionModel.findOneAndUpdate(
      { userId: req.userId },
      { messages: [], updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ success: true, message: "Chat history cleared." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to clear chat history." });
  }
});

// 6. POST /api/chat - RAG Chat powered by Gemini 3.5 Flash
app.post("/api/chat", requireAuth, async (req: Request, res: Response) => {
  const { message, activeSourceIds, chatHistory } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  // Load active sources from MongoDB
  let activeSources: any[] = [];
  try {
    if (activeSourceIds && activeSourceIds.length > 0) {
      activeSources = await KnowledgeSourceModel.find({
        _id: { $in: activeSourceIds },
        userId: req.userId,
      });
    } else {
      activeSources = await KnowledgeSourceModel.find({ userId: req.userId });
    }
  } catch (dbErr: any) {
    console.error("Error loading sources for chat:", dbErr);
  }

  let retrieved: Chunk[] = [];
  let contextText = "No active knowledge base sources selected or available.";

  if (activeSources.length > 0) {
    // Perform keyword retrieval
    retrieved = retrieveRelevantChunks(message, activeSources, 6);
    if (retrieved.length > 0) {
      contextText = retrieved
        .map((c, i) => `[Block ${i + 1}] Source: ${c.sourceName}\nContent: ${c.text}`)
        .join("\n\n---\n\n");
    }
  }

  try {
    const gemini = getGeminiClient();

    // Map conversation history into the structure for Gemini
    const systemInstruction = `You are a precise, minimalist RAG (Retrieval-Augmented Generation) Chatbot.
Your UI style is "clean, white, minimalistic" and your communication must be professional, direct, and helpful.

INSTRUCTIONS:
1. Ground your answer strictly in the provided Document Context blocks below.
2. If the answer cannot be found in the Document Context, explicitly state: "Based on the provided documents, I could not find information to answer this question." Then, you can provide a helpful response using your general training knowledge, but clearly separate it by stating it is from your general knowledge.
3. Keep answers concise, scannable, and extremely polished.
4. When referring to facts from a document block, cite the document name at the end of the sentence or paragraph, e.g. [Document Name.md] or [Web: domain.com]. Do not cite block numbers, use the source document name instead.
5. If no active knowledge source was provided or none are selected, answer using your general knowledge but remind the user they can upload files in the left panel to ground the chatbot.`;

    const contents: any[] = [];

    // Add prior chat history to contents if any exists
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((msg: Message) => {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        });
      });
    }

    // Append current user message with embedded context
    const currentPrompt = `Document Context:
${contextText}

----------------------

User Query: ${message}`;

    contents.push({
      role: "user",
      parts: [{ text: currentPrompt }],
    });

    // Call Gemini API server-side
    const response = await gemini.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.3, // Low temperature for factual, grounded RAG answers
      },
    });

    const answer = response.text || "I was unable to generate a response.";

    // Map citation data for client display
    const citations = retrieved.map(c => ({
      sourceId: c.sourceId,
      sourceName: c.sourceName,
      textExcerpt: c.text,
    }));

    res.json({
      answer,
      citations,
    });

  } catch (error: any) {
    console.error("Gemini API Error in /api/chat:", error);
    res.status(500).json({
      error: error.message || "An error occurred while contacting the AI service.",
    });
  }
});

/* ==========================================================================
   VITE DEV SERVER & STATIC FILE SERVING
   ========================================================================== */

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // In development mode, mount Vite middleware to enable HMR and live compilation
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware mounted successfully.");
  } else {
    // Serve pre-built static client files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static pre-built assets from /dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Minimalist RAG Chatbot running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
