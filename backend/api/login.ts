import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "./lib/db";
import { User } from "./lib/models";

const AUTH_USERNAME = process.env.AUTH_USERNAME || "admin";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "password";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    await connectDB();

    const user = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: username.trim().toLowerCase() },
      ],
    });

    if (user && user.password === password) {
      const token = Buffer.from(`${user.username}:${password}`).toString("base64");
      return res.json({
        success: true,
        token,
        user: { username: user.username, email: user.email },
      });
    }
  } catch (_dbErr) {
    // Fall through to env-based admin fallback
  }

  // Env-based admin fallback
  if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
    const token = Buffer.from(`${username}:${password}`).toString("base64");
    return res.json({
      success: true,
      token,
      user: { username, email: "admin@example.com" },
    });
  }

  return res.status(401).json({ error: "Invalid username or password" });
}
