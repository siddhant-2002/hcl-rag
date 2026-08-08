import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "./lib/db";
import { User } from "./lib/models";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, email, password, securityQuestion, securityAnswer } =
    req.body as {
      username?: string;
      email?: string;
      password?: string;
      securityQuestion?: string;
      securityAnswer?: string;
    };

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Username, email, and password are required." });
  }

  try {
    await connectDB();

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }],
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

    const token = Buffer.from(`${newUser.username}:${password}`).toString("base64");
    return res.status(201).json({
      success: true,
      message: "Account created successfully!",
      token,
      user: { username: newUser.username, email: newUser.email },
    });
  } catch (err: any) {
    console.error("Signup Error:", err);
    return res.status(500).json({ error: err.message || "Failed to create user account." });
  }
}
