import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { connectDB } from "../lib/db";
import { User } from "../lib/models";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { usernameOrEmail } = req.body as { usernameOrEmail?: string };
  if (!usernameOrEmail) {
    return res.status(400).json({ error: "Please enter your registered username or email." });
  }

  try {
    await connectDB();

    const query = usernameOrEmail.trim();
    const user = await User.findOne({
      $or: [{ username: query }, { email: query.toLowerCase() }],
    });

    if (!user) {
      return res.status(404).json({ error: "No account found with that username or email." });
    }

    const resetToken = crypto.randomBytes(24).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    const host = req.headers.host || "localhost:3000";
    const protocol = "https";
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
}
