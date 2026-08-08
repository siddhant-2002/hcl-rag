import mongoose from "mongoose";

/* ===== User ===== */
export interface IUser {
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
  createdAt: { type: Date, default: Date.now },
});

export const User =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);

/* ===== KnowledgeSource ===== */
export interface IKnowledgeSource {
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

export const KnowledgeSourceModel =
  (mongoose.models.KnowledgeSource as mongoose.Model<IKnowledgeSource>) ||
  mongoose.model<IKnowledgeSource>("KnowledgeSource", KnowledgeSourceSchema);

/* ===== ChatSession ===== */
export interface IChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
  citations?: Array<{ sourceId: string; sourceName: string; textExcerpt: string }>;
}

export interface IChatSession {
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
      citations: [{ sourceId: String, sourceName: String, textExcerpt: String }],
    },
  ],
  updatedAt: { type: Date, default: Date.now },
});

export const ChatSessionModel =
  (mongoose.models.ChatSession as mongoose.Model<IChatSession>) ||
  mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);

/* ===== Shared serializer ===== */
export function serializeSource(doc: any) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    type: doc.type,
    size: doc.size,
    wordCount: doc.wordCount,
    createdAt: doc.createdAt,
  };
}
