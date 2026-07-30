import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";
import cron from "node-cron";
import { getGoal, getProfile, getSpendingByCategory } from "./database.js";

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "loaded" : "MISSING");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  family: 4,
  tls: {
    rejectUnauthorized: false,
  },
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function buildEmail(profile, goal, spending) {
  const today = new Date();
  const deadline = new Date(goal.deadline);
  const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
  const progressPercent = Math.round((goal.saved_amount / goal.target_amount) * 100);
  const topSpend = spending[0];

  return {
    from: process.env.EMAIL_USER,
    to: profile.email,
    subject: `FinAgent — Day ${Math.round(goal.months * 30 - daysLeft + 1)} of your ${goal.name} goal`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;background:#f9f9f9;border-radius:12px;">
        <h2 style="color:#0D9488;margin:0 0 4px;">Good morning, ${profile.name || "there"} 👋</h2>
        <p style="color:#555;margin:0 0 20px;">Here's your FinAgent daily briefing.</p>

        <div style="background:white;border-radius:10px;padding:18px;margin-bottom:14px;border-left:4px solid #0D9488;">
          <p style="margin:0 0 6px;font-size:13px;color:#888;">YOUR GOAL</p>
          <p style="margin:0;font-size:18px;font-weight:600;color:#111;">${goal.name}</p>
          <p style="margin:4px 0 12px;color:#555;">₹${goal.saved_amount.toLocaleString()} saved of ₹${goal.target_amount.toLocaleString()}</p>
          <div style="background:#eee;border-radius:4px;height:8px;">
            <div style="background:#0D9488;width:${progressPercent}%;height:8px;border-radius:4px;"></div>
          </div>
          <p style="margin:8px 0 0;font-size:13px;color:#555;">${progressPercent}% complete · ${daysLeft} days left</p>
        </div>

        <div style="background:white;border-radius:10px;padding:18px;margin-bottom:14px;border-left:4px solid #F59E0B;">
          <p style="margin:0 0 6px;font-size:13px;color:#888;">TODAY'S TARGET</p>
          <p style="margin:0;font-size:28px;font-weight:700;color:#111;">₹${goal.monthly_target.toLocaleString()}</p>
          <p style="margin:4px 0 0;color:#555;">to save today to stay on track</p>
        </div>

        ${topSpend ? `
        <div style="background:white;border-radius:10px;padding:18px;border-left:4px solid #F87171;">
          <p style="margin:0 0 6px;font-size:13px;color:#888;">WATCH OUT</p>
          <p style="margin:0;color:#111;">Your biggest spend category is <strong>${topSpend.category}</strong> at ₹${Math.round(topSpend.total).toLocaleString()}. Consider cutting here first.</p>
        </div>` : ""}

        <p style="margin:20px 0 0;font-size:12px;color:#aaa;text-align:center;">FinAgent · Your Autonomous Personal CFO</p>
      </div>
    `,
  };
}

export async function sendTestEmail(email, name) {
  const goal = getGoal();
  const spending = getSpendingByCategory();

  if (!goal) {
    return { success: false, reason: "No goal found — set a goal first in the chat" };
  }

  const today = new Date();
  const deadline = new Date(goal.deadline);
  const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
  const progressPercent = Math.min(100, Math.round((goal.saved_amount / goal.target_amount) * 100));
  const topSpend = spending[0];

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `FinAgent — Your daily financial briefing`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;background:#f9fafb;border-radius:12px;">
        <div style="background:#0D9488;border-radius:10px;padding:20px;margin-bottom:20px;">
          <h2 style="color:white;margin:0;font-size:20px;">Good morning, ${name} 👋</h2>
          <p style="color:#ccfbf1;margin:6px 0 0;font-size:14px;">Your FinAgent daily briefing</p>
        </div>

        <div style="background:white;border-radius:10px;padding:18px;margin-bottom:14px;">
          <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">YOUR GOAL</p>
          <p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#111;">${goal.name}</p>
          <p style="margin:0 0 12px;color:#6b7280;font-size:14px;">₹${goal.saved_amount?.toLocaleString()} saved of ₹${goal.target_amount?.toLocaleString()}</p>
          <div style="background:#f3f4f6;border-radius:6px;height:10px;overflow:hidden;">
            <div style="background:#0D9488;width:${progressPercent}%;height:10px;border-radius:6px;"></div>
          </div>
          <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">${progressPercent}% complete · ${daysLeft} days left</p>
        </div>

        <div style="background:white;border-radius:10px;padding:18px;margin-bottom:14px;border-left:4px solid #F59E0B;">
          <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">TODAY'S TARGET</p>
          <p style="margin:0;font-size:32px;font-weight:700;color:#111;">₹${goal.monthly_target?.toLocaleString()}</p>
          <p style="margin:4px 0 0;color:#6b7280;font-size:14px;">to save today to stay on track</p>
        </div>

        ${topSpend ? `
        <div style="background:white;border-radius:10px;padding:18px;border-left:4px solid #F87171;">
          <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">WATCH OUT</p>
          <p style="margin:0;color:#111;font-size:14px;">Your biggest spend is <strong>${topSpend.category}</strong> at ₹${Math.round(topSpend.total).toLocaleString()}. Cut here first.</p>
        </div>` : ""}

        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">FinAgent · Your Autonomous Personal CFO</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  return { success: true };
}

export function startEmailScheduler() {
  cron.schedule("0 8 * * *", async () => {
    console.log("Running daily email job...");
    const result = await sendTestEmail();
    console.log("Email result:", result);
  });
  console.log("Email scheduler started — daily at 8:00 AM");
}
