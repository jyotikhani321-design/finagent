import Database from "better-sqlite3";

const db = new Database("database.db");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      email_reminders INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        description TEXT, 
        amount REAL,
        category TEXT DEFAULT 'other',
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        target_amount REAL,
        saved_amount REAL DEFAULT 0,
        months INTEGER,
        monthly_target REAL,
        deadline TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY,
        risk_profile TEXT,
        email TEXT,
        name TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT,
        content TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
`);

export function createUser(name, email, hashedPassword) {
  const stmt = db.prepare(`
    INSERT INTO users (name, email, password) VALUES (?, ?, ?)
  `);
  return stmt.run(name, email, hashedPassword);
}

export function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

export function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function toggleEmailReminders(userId, enabled) {
  db.prepare("UPDATE users SET email_reminders = ? WHERE id = ?").run(enabled ? 1 : 0, userId);
}

export function insertTransactions(rows) {
    const insert = db.prepare(`
            INSERT INTO transactions (date, description, amount, category)
            VALUES (@date, @description, @amount, @category)
    `);

    const insertMany = db.transaction((rows) => {
        for (const row of rows) {
            insert.run({
                date: row.Date || row.date || "",
                description: row.Description || row.description || "",
                amount: parseFloat(row.Amount || row.amount || 0),
                category: categorise(row.Description || row.description || ""),
            });
        }
    });
    insertMany(rows);
}

export function insertOneTransaction(date, description, amount) {
    const insert = db.prepare(`
            INSERT INTO transactions (date, description, amount, category)
            VALUES (?, ?, ?, ?)
    `);
    insert.run(date, description, amount, categorise(description));
}

export function getTransactions() {
    return db.prepare("SELECT * FROM transactions ORDER BY date DESC").all();
}

export function getSpendingByCategory() {
    return db.prepare(`
        SELECT category, SUM(ABS(amount)) as total
        FROM transactions
        WHERE amount < 0
        GROUP BY category
        ORDER BY total DESC    
    `).all();
}

export function getMonthlyTrend() {
    return db.prepare(`
        SELECT 
            strftime('%Y-%m', date) as month,
            SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses
        FROM transactions
        GROUP BY month
        ORDER BY month ASC    
    `).all();
}

export function saveGoal(name, targetAmount, months) {
    const monthlyTarget = Math.round(targetAmount / months);
    const deadline = new Date();
    deadline.setMonth(deadline.getMonth() + months);

    const insert = db.prepare(`
        INSERT OR REPLACE INTO goals (id, name, target_amount, months, monthly_target, deadline)
        VALUES (1, ?, ?, ?, ?, ?)    
    `);
    insert.run(name, targetAmount, months, monthlyTarget, deadline.toISOString());
}

export function getGoal() {
  return db.prepare("SELECT * FROM goals WHERE id = 1").get();
}

export function updateGoalProgress(amount) {
  db.prepare(`
    UPDATE goals SET saved_amount = saved_amount + ? WHERE id = 1
  `).run(amount);
}

export function saveProfile(riskProfile, email, name) {
  db.prepare(`
    INSERT OR REPLACE INTO profile (id, risk_profile, email, name)
    VALUES (1, ?, ?, ?)
  `).run(riskProfile, email, name);
}

export function getProfile() {
  return db.prepare("SELECT * FROM profile WHERE id = 1").get();
}

export function saveChatMessage(role, content) {
  db.prepare(`
    INSERT INTO chat_history (role, content) VALUES (?, ?)
  `).run(role, content);
}

export function getChatHistory() {
  return db.prepare(`
    SELECT role, content FROM chat_history
    ORDER BY id DESC LIMIT 20
  `).all().reverse(); // reverse so oldest is first
}

export function clearChatHistory() {
  db.prepare("DELETE FROM chat_history").run();
}

function categorise(description) {
  const d = description.toLowerCase();
  if (d.includes("swiggy") || d.includes("zomato") || d.includes("food")) return "food delivery";
  if (d.includes("rent") || d.includes("pg")) return "rent";
  if (d.includes("netflix") || d.includes("spotify") || d.includes("prime") || d.includes("hotstar")) return "subscriptions";
  if (d.includes("petrol") || d.includes("uber") || d.includes("ola") || d.includes("rapido")) return "transport";
  if (d.includes("amazon") || d.includes("flipkart") || d.includes("myntra")) return "shopping";
  if (d.includes("electricity") || d.includes("wifi") || d.includes("broadband") || d.includes("bill")) return "utilities";
  if (d.includes("starbucks") || d.includes("cafe") || d.includes("coffee") || d.includes("chai")) return "cafe";
  if (d.includes("salary") || d.includes("credit") || d.includes("income")) return "income";
  if (d.includes("medical") || d.includes("pharmacy") || d.includes("doctor")) return "health";
  return "other";
}

export default db;