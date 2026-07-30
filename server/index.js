import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import Groq from "groq-sdk";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createUser, getUserByEmail, getUserById, toggleEmailReminders } from "./database.js";

import {
  insertTransactions, insertOneTransaction,
  getTransactions, getSpendingByCategory, getMonthlyTrend,
  saveGoal, getGoal, updateGoalProgress,
  saveProfile, getProfile,
  saveChatMessage, getChatHistory, clearChatHistory,
} from "./database.js";

import { sendTestEmail, startEmailScheduler } from "./emailService.js";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// start the email scheduler when server starts
startEmailScheduler();

app.post("/api/upload", upload.single("file"), (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => results.push(row))
    .on("end", () => {
      insertTransactions(results);
      fs.unlinkSync(req.file.path);
      res.json({ success: true, count: results.length });
    });
});

app.post("/api/profile", (req, res) => {
  const { riskProfile, email, name } = req.body;
  saveProfile(riskProfile, email, name);
  clearChatHistory();
  res.json({ success: true });
});

// Update your /api/dashboard endpoint:
app.get("/api/dashboard", (req, res) => {
  const savingsGap = getSavingsGap();
  res.json({
    transactions: getTransactions().slice(0, 50),
    spendingByCategory: getSpendingByCategory(),
    monthlyTrend: getMonthlyTrend(),
    goal: getGoal(),
    profile: getProfile(),
    financialSummary: {
      monthlyIncome: savingsGap.income,
      monthlyExpenses: savingsGap.expenses,
      savingsPotential: savingsGap.saveable_per_month
    }
  });
});

app.post("/api/goal", (req, res) => {
  const { name, targetAmount, months } = req.body;
  saveGoal(name, targetAmount, months);
  res.json({ success: true, goal: getGoal() });
});

app.post("/api/test-email", authMiddleware, async (req, res) => {
  const user = getUserById(req.user.id);
  const result = await sendTestEmail(user.email, user.name);
  res.json(result);
});

function analyseSpending() {
  return { breakdown: getSpendingByCategory() };
}

function calculateSIP({ goal_amount, months, expected_return_percent = 8 }) {
  const r = (expected_return_percent / 100) / 12;
  const sip = (goal_amount * r) / (Math.pow(1 + r, months) - 1);
  return {
    monthly_sip: Math.round(sip),
    goal_amount,
    months,
    total_invested: Math.round(sip * months),
  };
}

// Replace your existing getSavingsGap function with this:
function getSavingsGap() {
  const transactions = getTransactions();
  let income = 0, expenses = 0;
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  for (const t of transactions) {
    const transactionDate = new Date(t.date);
    // Only count current month's transactions
    if (transactionDate.getMonth() === currentMonth && 
        transactionDate.getFullYear() === currentYear) {
      if (t.amount > 0) {
        income += t.amount;
        console.log(`Income found: ${t.description} = +${t.amount}`);
      } else {
        expenses += Math.abs(t.amount);
        console.log(`Expense found: ${t.description} = -${Math.abs(t.amount)}`);
      }
    }
  }
  
  console.log(`Total Income: ${income}, Total Expenses: ${expenses}, Saveable: ${income - expenses}`);
  
  return {
    income: Math.round(income),
    expenses: Math.round(expenses),
    saveable_per_month: Math.round(income - expenses),
  };
}

function createGoalPlan({ goal_name, goal_amount, months }) {
  saveGoal(goal_name, goal_amount, months);
  const sip = calculateSIP({ goal_amount, months });
  const gap = getSavingsGap();
  return {
    goal_name, goal_amount, months,
    monthly_sip: sip.monthly_sip,
    is_achievable: gap.saveable_per_month >= sip.monthly_sip,
    advice: `Save ₹${sip.monthly_sip} every month to reach ₹${goal_amount.toLocaleString()} in ${months} months.`,
  };
}

function addExpense({ description, amount, date }) {
  const d = date || new Date().toISOString().split("T")[0];
  insertOneTransaction(d, description, -Math.abs(amount));
  return { success: true, message: `Added expense: ₹${amount} for ${description}` };
}

// ADD THIS NEW FUNCTION FOR INCOME
function addIncome({ description, amount, date }) {
  const d = date || new Date().toISOString().split("T")[0];
  insertOneTransaction(d, description, Math.abs(amount)); // POSITIVE amount
  return { success: true, message: `Added income: ₹${amount} from ${description}` };
}

const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "analyse_spending",
      description: "Analyses spending by category from the database. Use when user asks about spending habits.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_sip",
      description: "Calculates monthly SIP needed to reach a financial goal.",
      parameters: {
        type: "object",
        properties: {
          goal_amount: { type: "number" },
          months: { type: "number" },
          expected_return_percent: { type: "number" },
        },
        required: ["goal_amount", "months"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_savings_gap",
      description: "Gets monthly income, expenses, and how much can be saved.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_goal_plan",
      description: "Creates a savings goal plan and saves it to the database.",
      parameters: {
        type: "object",
        properties: {
          goal_name: { type: "string" },
          goal_amount: { type: "number" },
          months: { type: "number" },
        },
        required: ["goal_name", "goal_amount", "months"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_expense",
      description: "Adds a single expense to the database. Use when user says 'spent X on Y'.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string" },
          amount: { type: "number" },
          date: { type: "string" },
        },
        required: ["description", "amount"],
      },
    },
  },
  // ADD THIS NEW TOOL FOR INCOME
  {
    type: "function",
    function: {
      name: "add_income",
      description: "Adds income to the database. Use when user says 'earned X from Y' or 'salary is X'.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string" },
          amount: { type: "number" },
          date: { type: "string" },
        },
        required: ["description", "amount"],
      },
    },
  },
];

function executeTool(name, args) {
  console.log(`   Tool: ${name}`, args);
  switch (name) {
    case "analyse_spending":  return analyseSpending();
    case "calculate_sip":     return calculateSIP(args);
    case "get_savings_gap":   return getSavingsGap();
    case "create_goal_plan":  return createGoalPlan(args);
    case "add_expense":       return addExpense(args);
    case "add_income":        return addIncome(args);  // ADD THIS LINE
    default: return { error: "Unknown tool" };
  }
}

// ── AGENT CHAT ───────────────────────────────────────────────

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "No message" });

    const profile = getProfile();
    const goal = getGoal();

    const systemPrompt = `You are FinAgent, an autonomous personal CFO for Indian users.
User profile: ${JSON.stringify(profile)}
Current goal: ${JSON.stringify(goal)}
Today's date: ${new Date().toLocaleDateString("en-IN")}

You have tools to read and write to a real database.
- When user says "spent X on Y" — use add_expense tool
- When user says "earned X from Y" or "salary X" — use add_income tool
- When user sets a goal — use create_goal_plan tool
Always use tools before answering financial questions.
Be direct, specific, like a smart friend. Use ₹ for amounts.`;

    const history = getChatHistory();
    saveChatMessage("user", message);

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message },
    ];

    const agentSteps = [];
    let finalReply = "";

    while (true) {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        messages,
        tools: toolDefinitions,
        tool_choice: "auto",
      });

      const choice = response.choices[0];

      if (choice.finish_reason === "tool_calls") {
        messages.push(choice.message);
        for (const call of choice.message.tool_calls) {
          const toolName = call.function.name;
          const toolArgs = JSON.parse(call.function.arguments || "{}");
          agentSteps.push(`Running: ${toolName.replace(/_/g, " ")}`);
          const result = executeTool(toolName, toolArgs);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
      } else {
        finalReply = choice.message.content;
        break;
      }
    }

    saveChatMessage("assistant", finalReply);

    res.json({ reply: finalReply, steps: agentSteps });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/transactions", (req, res) => {
  res.json(getTransactions().slice(0, 30));
});

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields required" });

    const existing = getUserByEmail(email);
    if (existing)
      return res.status(400).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const result = createUser(name, email, hashed);
    const token = jwt.sign({ id: result.lastInsertRowid, email }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, user: { name, email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = getUserByEmail(email);
    if (!user) return res.status(400).json({ error: "Email not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/email-reminders", authMiddleware, async (req, res) => {
  const { enabled } = req.body;
  toggleEmailReminders(req.user.id, enabled);

  if (enabled) {
    await sendTestEmail(req.user.email, req.user.name || "there");
  }

  res.json({ success: true, enabled });
});

// Add this AFTER your other app.post endpoints
app.post("/api/onboard/initial-setup", async (req, res) => {
  try {
    const { income, expenses, riskProfile, name, email } = req.body;
    const today = new Date().toISOString().split("T")[0];
    
    // Save profile
    saveProfile(riskProfile, email, name);
    
    // Add income as POSITIVE transaction (direct database insert)
    if (income && income > 0) {
      insertOneTransaction(today, "Monthly Salary", Math.abs(income));
      console.log(`Added income: +${income}`);
    }
    
    // Add expenses as NEGATIVE transaction
    if (expenses && expenses > 0) {
      insertOneTransaction(today, "Monthly Expenses", -Math.abs(expenses));
      console.log(`Added expense: -${expenses}`);
    }
    
    res.json({ 
      success: true, 
      message: `Setup complete with income: ₹${income}, expenses: ₹${expenses}` 
    });
  } catch (error) {
    console.error("Setup error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT || 4000, () => {
  console.log("FinAgent server running on port 4000");
});