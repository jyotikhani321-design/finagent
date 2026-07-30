import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar
} from "recharts";

const API = "http://localhost:4000";
const COLORS = ["#0D9488","#F59E0B","#818CF8","#F87171","#34D399","#60A5FA","#F472B6","#A78BFA"];

// ── AUTH HELPER ───────────────────────────────────────────────
const getToken = () => localStorage.getItem("token");
const getUser = () => JSON.parse(localStorage.getItem("user") || "null");
const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

// ── SMALL COMPONENTS ─────────────────────────────────────────

function StatCard({ label, value, sub, color = "#0D9488" }) {
  return (
    <div style={{ background:"white", borderRadius:12, padding:"16px 20px", border:"0.5px solid #e5e7eb", flex:1, minWidth:140 }}>
      <p style={{ margin:"0 0 4px", fontSize:12, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</p>
      <p style={{ margin:"0 0 2px", fontSize:26, fontWeight:700, color }}>{value}</p>
      {sub && <p style={{ margin:0, fontSize:12, color:"#6b7280" }}>{sub}</p>}
    </div>
  );
}

function GoalCard({ goal }) {
  if (!goal) return (
    <div style={{ background:"white", borderRadius:12, padding:20, border:"0.5px solid #e5e7eb" }}>
      <p style={{ color:"#9ca3af", fontSize:14, margin:0 }}>No goal set yet. Tell the agent your savings goal in the chat.</p>
    </div>
  );
  const pct = Math.min(100, Math.round((goal.saved_amount / goal.target_amount) * 100));
  const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000*60*60*24));
  return (
    <div style={{ background:"white", borderRadius:12, padding:20, border:"0.5px solid #e5e7eb" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
        <div>
          <p style={{ margin:"0 0 2px", fontSize:16, fontWeight:600 }}>{goal.name}</p>
          <p style={{ margin:0, fontSize:13, color:"#6b7280" }}>₹{goal.saved_amount?.toLocaleString()} of ₹{goal.target_amount?.toLocaleString()}</p>
        </div>
        <div style={{ textAlign:"right" }}>
          <p style={{ margin:"0 0 2px", fontSize:22, fontWeight:700, color:"#0D9488" }}>{pct}%</p>
          <p style={{ margin:0, fontSize:12, color:"#9ca3af" }}>{daysLeft}d left</p>
        </div>
      </div>
      <div style={{ background:"#f3f4f6", borderRadius:6, height:10, overflow:"hidden" }}>
        <div style={{ background:"#0D9488", width:`${pct}%`, height:"100%", borderRadius:6, transition:"width 0.8s ease" }} />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
        <p style={{ margin:0, fontSize:12, color:"#6b7280" }}>Monthly: ₹{goal.monthly_target?.toLocaleString()}</p>
        <p style={{ margin:0, fontSize:12, color:"#0D9488" }}>Due: {new Date(goal.deadline).toLocaleDateString("en-IN")}</p>
      </div>
    </div>
  );
}

// Updated TransactionFeed to show all or limited transactions
function TransactionFeed({ transactions, limit = null }) {
  const displayTransactions = limit ? transactions.slice(0, limit) : transactions;
  
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {displayTransactions.map((t,i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"white", borderRadius:10, border:"0.5px solid #e5e7eb" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:t.amount<0?"#FEF2F2":"#ECFDF5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>
              {t.amount < 0 ? "↓" : "↑"}
            </div>
            <div>
              <p style={{ margin:"0 0 2px", fontSize:13, fontWeight:500 }}>{t.description}</p>
              <p style={{ margin:0, fontSize:11, color:"#9ca3af" }}>{t.category || "general"} · {t.date}</p>
            </div>
          </div>
          <p style={{ margin:0, fontSize:14, fontWeight:600, color:t.amount<0?"#ef4444":"#10b981" }}>
            {t.amount<0?"-":"+"}₹{Math.abs(t.amount).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── HOMEPAGE ─────────────────────────────────────────────────

function HomePage({ onLogin, onSignup }) {
  const features = [
    { icon: "📊", title: "Real data analysis", desc: "Upload your bank CSV and get instant AI-powered spending breakdown by category." },
    { icon: "🤖", title: "Autonomous agent", desc: "Not a chatbot — an AI agent that picks tools, runs calculations, and builds your plan." },
    { icon: "🎯", title: "Goal tracking", desc: "Set a savings goal and track progress with a live dashboard that updates in real time." },
    { icon: "📧", title: "Daily reminders", desc: "Get a personalised email every morning with today's savings target and spending alerts." },
    { icon: "💬", title: "Natural expense logging", desc: "Just say 'spent 450 on Swiggy' — the agent adds it to your history automatically." },
    { icon: "🔍", title: "Explainable AI", desc: "Every recommendation shows its reasoning — no black box, full transparency." },
  ];

  return (
    <div style={{ fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background:"#f9fafb", minHeight:"100vh" }}>

      {/* NAV */}
      <nav style={{ background:"white", borderBottom:"0.5px solid #e5e7eb", padding:"14px 40px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ background:"#0D9488", color:"white", fontWeight:700, fontSize:14, padding:"5px 10px", borderRadius:8 }}>FA</div>
          <span style={{ fontWeight:700, fontSize:18, color:"#111" }}>FinAgent</span>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onLogin} style={{ padding:"9px 22px", background:"white", border:"0.5px solid #d1d5db", borderRadius:9, fontSize:14, fontWeight:500, cursor:"pointer", color:"#374151" }}>
            Log in
          </button>
          <button onClick={onSignup} style={{ padding:"9px 22px", background:"#0D9488", border:"none", borderRadius:9, fontSize:14, fontWeight:500, cursor:"pointer", color:"white" }}>
            Sign up free
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ textAlign:"center", padding:"80px 24px 60px", maxWidth:720, margin:"0 auto" }}>
        <div style={{ display:"inline-block", background:"#ECFDF5", color:"#0D9488", fontSize:13, fontWeight:600, padding:"5px 14px", borderRadius:20, marginBottom:24, border:"0.5px solid #6EE7B7" }}>
          Personal Finance Track · Protex Hackathon 2026
        </div>
        <h1 style={{ fontSize:54, fontWeight:800, color:"#111", margin:"0 0 20px", lineHeight:1.15 }}>
          Your autonomous<br />
          <span style={{ color:"#0D9488" }}>personal CFO</span>
        </h1>
        <p style={{ fontSize:18, color:"#6b7280", margin:"0 0 36px", lineHeight:1.7 }}>
          FinAgent doesn't just show you charts — it reasons over your real bank data, calls financial tools, and builds a personalised action plan. Automatically.
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <button onClick={onSignup} style={{ padding:"14px 32px", background:"#0D9488", color:"white", border:"none", borderRadius:12, fontSize:16, fontWeight:600, cursor:"pointer" }}>
            Get started free →
          </button>
          <button onClick={onLogin} style={{ padding:"14px 32px", background:"white", color:"#374151", border:"0.5px solid #d1d5db", borderRadius:12, fontSize:16, cursor:"pointer" }}>
            Log in
          </button>
        </div>
      </div>

      {/* DEMO VISUAL */}
      <div style={{ maxWidth:900, margin:"0 auto 60px", padding:"0 24px" }}>
        <div style={{ background:"white", borderRadius:20, border:"0.5px solid #e5e7eb", overflow:"hidden" }}>
          <div style={{ background:"#f3f4f6", padding:"10px 16px", display:"flex", alignItems:"center", gap:6, borderBottom:"0.5px solid #e5e7eb" }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:"#F87171" }} />
            <div style={{ width:10, height:10, borderRadius:"50%", background:"#F59E0B" }} />
            <div style={{ width:10, height:10, borderRadius:"50%", background:"#34D399" }} />
            <div style={{ flex:1, background:"white", borderRadius:6, padding:"4px 12px", fontSize:12, color:"#9ca3af", marginLeft:8 }}>localhost:3000/dashboard</div>
          </div>
          <div style={{ padding:24, background:"#f9fafb" }}>
            <div style={{ display:"flex", gap:12, marginBottom:16 }}>
              {[
                { label:"Monthly income", val:"₹45,000", color:"#0D9488" },
                { label:"Total expenses", val:"₹28,500", color:"#ef4444" },
                { label:"Saveable", val:"₹16,500", color:"#10b981" },
                { label:"Transactions", val:"15", color:"#818CF8" },
              ].map((s,i) => (
                <div key={i} style={{ flex:1, background:"white", borderRadius:10, padding:"12px 14px", border:"0.5px solid #e5e7eb" }}>
                  <p style={{ margin:"0 0 4px", fontSize:10, color:"#9ca3af", textTransform:"uppercase" }}>{s.label}</p>
                  <p style={{ margin:0, fontSize:20, fontWeight:700, color:s.color }}>{s.val}</p>
                </div>
              ))}
            </div>
            <div style={{ background:"white", borderRadius:12, padding:16, border:"0.5px solid #e5e7eb" }}>
              <p style={{ margin:"0 0 10px", fontWeight:600, fontSize:13 }}>Savings goal — Goa trip</p>
              <div style={{ background:"#f3f4f6", borderRadius:6, height:10, overflow:"hidden" }}>
                <div style={{ background:"#0D9488", width:"62%", height:"100%", borderRadius:6 }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                <p style={{ margin:0, fontSize:11, color:"#6b7280" }}>₹49,600 of ₹80,000</p>
                <p style={{ margin:0, fontSize:11, color:"#0D9488" }}>62% · 38 days left</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div style={{ maxWidth:960, margin:"0 auto 80px", padding:"0 24px" }}>
        <h2 style={{ textAlign:"center", fontSize:34, fontWeight:700, color:"#111", margin:"0 0 8px" }}>Everything you need</h2>
        <p style={{ textAlign:"center", color:"#6b7280", margin:"0 0 40px", fontSize:16 }}>Built in a hackathon. Designed for real life.</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16 }}>
          {features.map((f,i) => (
            <div key={i} style={{ background:"white", borderRadius:14, padding:24, border:"0.5px solid #e5e7eb" }}>
              <div style={{ fontSize:28, marginBottom:12 }}>{f.icon}</div>
              <p style={{ margin:"0 0 8px", fontWeight:600, fontSize:15, color:"#111" }}>{f.title}</p>
              <p style={{ margin:0, fontSize:13, color:"#6b7280", lineHeight:1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background:"#0D9488", padding:"60px 24px", textAlign:"center" }}>
        <h2 style={{ color:"white", fontSize:32, fontWeight:700, margin:"0 0 12px" }}>Ready to take control?</h2>
        <p style={{ color:"#ccfbf1", margin:"0 0 28px", fontSize:16 }}>Free to use. No credit card. Just your finances, finally sorted.</p>
        <button onClick={onSignup} style={{ padding:"14px 36px", background:"white", color:"#0D9488", border:"none", borderRadius:12, fontSize:16, fontWeight:700, cursor:"pointer" }}>
          Create free account →
        </button>
      </div>

      <footer style={{ textAlign:"center", padding:"24px", color:"#9ca3af", fontSize:13, background:"white", borderTop:"0.5px solid #e5e7eb" }}>
        FinAgent · Built for Protex Hackathon 2026 · Personal Finance Track
      </footer>
    </div>
  );
}

// ── AUTH SCREENS ─────────────────────────────────────────────

function AuthScreen({ mode, onSuccess, onSwitch }) {
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
      const payload = isLogin
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const res = await axios.post(`${API}${endpoint}`, payload);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    }
    setLoading(false);
  };

  const inputStyle = {
    width:"100%", padding:"12px 16px", borderRadius:10,
    border:"0.5px solid #d1d5db", fontSize:15, outline:"none",
    boxSizing:"border-box", marginBottom:12,
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f9fafb" }}>
      <div style={{ background:"white", borderRadius:20, padding:40, width:"100%", maxWidth:440, border:"0.5px solid #e5e7eb" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:28 }}>
          <div style={{ background:"#0D9488", color:"white", fontWeight:700, fontSize:13, padding:"4px 9px", borderRadius:7 }}>FA</div>
          <span style={{ fontWeight:700, fontSize:17 }}>FinAgent</span>
        </div>

        <h2 style={{ margin:"0 0 6px", fontSize:24, fontWeight:700 }}>
          {isLogin ? "Welcome back" : "Create your account"}
        </h2>
        <p style={{ margin:"0 0 24px", color:"#6b7280", fontSize:14 }}>
          {isLogin ? "Log in to your FinAgent dashboard" : "Start taking control of your finances"}
        </p>

        {!isLogin && (
          <input
            style={inputStyle}
            placeholder="Your name"
            value={form.name}
            onChange={e => setForm({...form, name:e.target.value})}
          />
        )}
        <input
          style={inputStyle}
          placeholder="Email address"
          type="email"
          value={form.email}
          onChange={e => setForm({...form, email:e.target.value})}
        />
        <input
          style={inputStyle}
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={e => setForm({...form, password:e.target.value})}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />

        {error && (
          <p style={{ color:"#ef4444", fontSize:13, margin:"0 0 12px" }}>{error}</p>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{
          width:"100%", padding:13, background:"#0D9488", color:"white",
          border:"none", borderRadius:10, fontSize:15, fontWeight:600, cursor:"pointer", marginBottom:14
        }}>
          {loading ? "Please wait..." : isLogin ? "Log in →" : "Create account →"}
        </button>

        <p style={{ textAlign:"center", fontSize:14, color:"#6b7280", margin:0 }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={onSwitch} style={{ color:"#0D9488", cursor:"pointer", fontWeight:500 }}>
            {isLogin ? "Sign up" : "Log in"}
          </span>
        </p>
      </div>
    </div>
  );
}

// ── ONBOARDING ────────────────────────────────────────────────

const RISK_QUESTIONS = [
  "What is your monthly income? (e.g. ₹45,000)",
  "What are your fixed monthly expenses? (e.g. ₹20,000)",
  "On a scale of 1–10, how comfortable are you with financial risk?",
  "What is your biggest financial worry right now?",
];

function OnboardScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [input, setInput] = useState("");

  const handleNext = async () => {
    if (!input.trim()) return;
    const newAnswers = [...answers, input];
    setAnswers(newAnswers);
    setInput("");
    
    if (newAnswers.length < RISK_QUESTIONS.length) {
      setStep(step + 1);
    } else {
      const incomeMatch = newAnswers[0].match(/(\d+(?:,\d+)?)/);
      const monthlyIncome = incomeMatch ? parseInt(incomeMatch[0].replace(/,/g, '')) : 0;
      
      const expensesMatch = newAnswers[1].match(/(\d+(?:,\d+)?)/);
      const monthlyExpenses = expensesMatch ? parseInt(expensesMatch[0].replace(/,/g, '')) : 0;
      
      const riskProfile = `Income: ${newAnswers[0]}, Expenses: ${newAnswers[1]}, Risk: ${newAnswers[2]}/10, Worry: ${newAnswers[3]}`;
      const user = getUser();
      
      await axios.post(`${API}/api/onboard/initial-setup`, {
        income: monthlyIncome,
        expenses: monthlyExpenses,
        riskProfile: riskProfile,
        name: user?.name,
        email: user?.email,
      }, { headers: authHeader() });
      
      onDone();
    }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f9fafb" }}>
      <div style={{ background:"white", borderRadius:20, padding:40, width:"100%", maxWidth:480, border:"0.5px solid #e5e7eb" }}>
        <p style={{ margin:"0 0 6px", fontSize:12, color:"#0D9488", fontWeight:600, letterSpacing:"0.05em" }}>
          STEP {step + 1} OF {RISK_QUESTIONS.length}
        </p>
        <div style={{ background:"#f3f4f6", borderRadius:4, height:4, marginBottom:28 }}>
          <div style={{ background:"#0D9488", width:`${(step/RISK_QUESTIONS.length)*100}%`, height:4, borderRadius:4, transition:"width 0.3s" }} />
        </div>
        <h2 style={{ margin:"0 0 24px", fontSize:22, fontWeight:600, lineHeight:1.4 }}>
          {RISK_QUESTIONS[step]}
        </h2>
        <input
          autoFocus value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleNext()}
          placeholder="Type your answer..."
          style={{ width:"100%", padding:"12px 16px", borderRadius:10, border:"0.5px solid #d1d5db", fontSize:15, outline:"none", boxSizing:"border-box", marginBottom:14 }}
        />
        <button onClick={handleNext} style={{ width:"100%", padding:12, background:"#0D9488", color:"white", border:"none", borderRadius:10, fontSize:15, fontWeight:500, cursor:"pointer" }}>
          {step < RISK_QUESTIONS.length - 1 ? "Next →" : "Let's go"}
        </button>
      </div>
    </div>
  );
}

// ── UPLOAD SCREEN ─────────────────────────────────────────────

function UploadScreen({ onDone }) {
  const [status, setStatus] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus("Uploading...");
    const form = new FormData();
    form.append("file", file);
    const res = await axios.post(`${API}/api/upload`, form, { headers: authHeader() });
    setStatus(`✓ ${res.data.count} transactions loaded`);
    setTimeout(onDone, 900);
  };

  const downloadDemo = () => {
    const demo = `Date,Description,Amount\n2024-03-01,Swiggy,-450\n2024-03-02,Salary,45000\n2024-03-03,Zomato,-380\n2024-03-04,Amazon,-1200\n2024-03-05,Rent,-12000\n2024-03-06,Swiggy,-520\n2024-03-07,Netflix,-649\n2024-03-08,Starbucks,-480\n2024-03-09,Spotify,-119\n2024-03-10,Swiggy,-390\n2024-03-11,Electricity,-800\n2024-03-12,Zomato,-650\n2024-03-13,Petrol,-1500\n2024-03-14,Swiggy,-420\n2024-03-15,Amazon,-2300`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([demo], { type:"text/csv" }));
    a.download = "demo_transactions.csv";
    a.click();
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f9fafb" }}>
      <div style={{ background:"white", borderRadius:20, padding:40, width:"100%", maxWidth:480, border:"0.5px solid #e5e7eb" }}>
        <h2 style={{ margin:"0 0 8px", fontSize:22, fontWeight:600 }}>Upload your bank statement</h2>
        <p style={{ margin:"0 0 24px", color:"#6b7280", fontSize:14 }}>CSV with Date, Description, Amount columns</p>
        <label style={{ display:"flex", alignItems:"center", justifyContent:"center", border:"1.5px dashed #d1d5db", borderRadius:12, padding:"2.5rem", cursor:"pointer", fontSize:14, color:"#6b7280", marginBottom:12, minHeight:110 }}>
          <input type="file" accept=".csv" onChange={handleFile} style={{ display:"none" }} />
          {status || "Click to upload CSV"}
        </label>
        <button onClick={downloadDemo} style={{ width:"100%", padding:10, background:"#f9fafb", border:"0.5px solid #e5e7eb", borderRadius:10, fontSize:13, color:"#6b7280", cursor:"pointer" }}>
          Download demo CSV to test
        </button>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────

function Dashboard({ onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [dash, setDash] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [income, setIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const bottomRef = useRef(null);
  const user = getUser();

  const loadDash = async () => {
    const [d, t] = await Promise.all([
      axios.get(`${API}/api/dashboard`, { headers: authHeader() }),
      axios.get(`${API}/api/transactions`, { headers: authHeader() }),
    ]);
    setDash(d.data);
    setTransactions(t.data);
    
    // Calculate income and expenses directly from transactions for current month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    let totalIncome = 0;
    let totalExp = 0;
    
    for (const tx of t.data) {
      const txDate = new Date(tx.date);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        if (tx.amount > 0) {
          totalIncome += tx.amount;
        } else {
          totalExp += Math.abs(tx.amount);
        }
      }
    }
    
    setIncome(totalIncome);
    setTotalExpenses(totalExp);
  };

  useEffect(() => { loadDash(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const sendMessage = async (text) => {
    const msg = text || input;
    if (!msg.trim()) return;
    setInput("");
    setMessages(prev => [...prev, { role:"user", text:msg }]);
    setLoading(true);
    const res = await axios.post(`${API}/api/chat`, { message:msg }, { headers: authHeader() });
    setLoading(false);
    setMessages(prev => [...prev, { role:"agent", text:res.data.reply, steps:res.data.steps||[] }]);
    loadDash();
  };

  const toggleEmail = async () => {
    setEmailLoading(true);
    const newState = !emailEnabled;
    await axios.post(`${API}/api/email-reminders`, { enabled:newState }, { headers: authHeader() });
    setEmailEnabled(newState);
    setEmailLoading(false);
    if (newState) alert("Daily reminders enabled! A confirmation email was sent to your inbox.");
  };

  const savings = income - totalExpenses;

  const navStyle = (t) => ({
    padding:"8px 18px", borderRadius:8, fontSize:14, cursor:"pointer",
    fontWeight:tab===t?600:400,
    background:tab===t?"#0D9488":"transparent",
    color:tab===t?"white":"#6b7280",
    border:"none",
  });

  return (
    <div style={{ minHeight:"100vh", background:"#f9fafb", fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* NAV */}
      <div style={{ background:"white", borderBottom:"0.5px solid #e5e7eb", padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ background:"#0D9488", color:"white", fontWeight:700, fontSize:14, padding:"4px 10px", borderRadius:8 }}>FA</div>
          <span style={{ fontWeight:600, fontSize:16 }}>FinAgent</span>
          {user?.name && <span style={{ fontSize:13, color:"#9ca3af" }}>· {user.name}</span>}
        </div>
        <div style={{ display:"flex", gap:4 }}>
          <button style={navStyle("dashboard")} onClick={() => setTab("dashboard")}>Dashboard</button>
          <button style={navStyle("chat")} onClick={() => setTab("chat")}>AI Agent</button>
          <button style={navStyle("transactions")} onClick={() => setTab("transactions")}>Transactions</button>
          <button style={navStyle("settings")} onClick={() => setTab("settings")}>Settings</button>
        </div>
        <button onClick={onLogout} style={{ padding:"8px 14px", background:"#fef2f2", border:"0.5px solid #fca5a5", borderRadius:8, fontSize:13, color:"#ef4444", cursor:"pointer" }}>
          Log out
        </button>
      </div>

      {/* DASHBOARD TAB */}
      {tab === "dashboard" && (
        <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>
          <div style={{ display:"flex", gap:14, marginBottom:24, flexWrap:"wrap" }}>
            <StatCard label="Monthly income" value={`₹${income.toLocaleString()}`} sub="from transactions" color="#0D9488" />
            <StatCard label="Total expenses" value={`₹${totalExpenses.toLocaleString()}`} sub="this month" color="#ef4444" />
            <StatCard label="Saveable" value={`₹${savings.toLocaleString()}`} sub="per month" color={savings>0?"#10b981":"#ef4444"} />
            <StatCard label="Transactions" value={transactions.length} sub="recorded" color="#818CF8" />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:24 }}>
            <div style={{ background:"white", borderRadius:14, padding:20, border:"0.5px solid #e5e7eb" }}>
              <p style={{ margin:"0 0 16px", fontWeight:600, fontSize:15 }}>Spending by category</p>
              {dash?.spendingByCategory?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={dash.spendingByCategory.filter(s=>s.category!=="income")} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={85} innerRadius={50}>
                      {dash.spendingByCategory.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v=>`₹${Math.round(v).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p style={{ color:"#9ca3af", fontSize:13, textAlign:"center", paddingTop:60 }}>Upload transactions to see breakdown</p>}
            </div>

            <div style={{ background:"white", borderRadius:14, padding:20, border:"0.5px solid #e5e7eb" }}>
              <p style={{ margin:"0 0 16px", fontWeight:600, fontSize:15 }}>Monthly trend</p>
              {dash?.monthlyTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={dash.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize:11, fill:"#9ca3af" }} />
                    <YAxis tick={{ fontSize:11, fill:"#9ca3af" }} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v=>`₹${Math.round(v).toLocaleString()}`} />
                    <Line type="monotone" dataKey="income" stroke="#0D9488" strokeWidth={2} dot={false} name="Income" />
                    <Line type="monotone" dataKey="expenses" stroke="#F87171" strokeWidth={2} dot={false} name="Expenses" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p style={{ color:"#9ca3af", fontSize:13, textAlign:"center", paddingTop:60 }}>No trend data yet</p>}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div>
              <p style={{ margin:"0 0 10px", fontWeight:600, fontSize:15 }}>Savings goal</p>
              <GoalCard goal={dash?.goal} />
              {dash?.spendingByCategory?.filter(s=>s.category!=="income").length > 0 && (
                <div style={{ background:"white", borderRadius:14, padding:20, border:"0.5px solid #e5e7eb", marginTop:16 }}>
                  <p style={{ margin:"0 0 14px", fontWeight:600, fontSize:15 }}>Top categories</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={dash.spendingByCategory.filter(s=>s.category!=="income").slice(0,5)} layout="vertical">
                      <XAxis type="number" tick={{ fontSize:11, fill:"#9ca3af" }} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="category" tick={{ fontSize:11, fill:"#6b7280" }} width={90} />
                      <Tooltip formatter={v=>`₹${Math.round(v).toLocaleString()}`} />
                      <Bar dataKey="total" radius={[0,6,6,0]}>
                        {dash.spendingByCategory.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div>
              <p style={{ margin:"0 0 10px", fontWeight:600, fontSize:15 }}>Recent transactions</p>
              <TransactionFeed transactions={transactions} limit={5} />
              {transactions.length > 5 && (
                <button 
                  onClick={() => setTab("transactions")} 
                  style={{ marginTop:12, width:"100%", padding:"8px", background:"#f9fafb", border:"0.5px solid #e5e7eb", borderRadius:8, fontSize:12, color:"#0D9488", cursor:"pointer" }}
                >
                  View all {transactions.length} transactions →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CHAT TAB */}
      {tab === "chat" && (
        <div style={{ maxWidth:720, margin:"0 auto", padding:24, display:"flex", flexDirection:"column", height:"calc(100vh - 57px)" }}>
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            {["What are my biggest spending leaks?","spent 350 on lunch today","Save ₹80,000 in 5 months for a trip","How much can I save per month?"].map(q => (
              <button key={q} onClick={() => sendMessage(q)} style={{ padding:"6px 14px", background:"white", border:"0.5px solid #e5e7eb", borderRadius:20, fontSize:12, color:"#374151", cursor:"pointer" }}>{q}</button>
            ))}
          </div>
          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:12, paddingBottom:12 }}>
            {messages.length === 0 && (
              <div style={{ textAlign:"center", marginTop:80, color:"#9ca3af" }}>
                <p style={{ fontSize:16, marginBottom:6 }}>Ask me anything about your finances.</p>
                <p style={{ fontSize:13 }}>I can see your full transaction history and goals.</p>
              </div>
            )}
            {messages.map((m,i) => (
              <div key={i} style={{ alignSelf:m.role==="user"?"flex-end":"flex-start", maxWidth:"82%" }}>
                {m.role==="agent" && m.steps?.length>0 && (
                  <div style={{ marginBottom:6 }}>
                    {m.steps.map((s,j) => <div key={j} style={{ fontSize:11, color:"#0D9488", marginBottom:2 }}>✓ {s}</div>)}
                  </div>
                )}
                <div style={{
                  padding:"12px 16px", fontSize:14, lineHeight:1.6,
                  background:m.role==="user"?"#0D9488":"white",
                  color:m.role==="user"?"white":"#111",
                  border:m.role==="agent"?"0.5px solid #e5e7eb":"none",
                  borderRadius:m.role==="user"?"14px 14px 2px 14px":"14px 14px 14px 2px",
                }}>{m.text}</div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf:"flex-start", background:"white", border:"0.5px solid #e5e7eb", borderRadius:14, padding:"12px 16px", display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#6b7280" }}>
                <div style={{ width:12, height:12, border:"2px solid #e5e7eb", borderTopColor:"#0D9488", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
                Agent thinking...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ display:"flex", gap:10, paddingTop:12, borderTop:"0.5px solid #e5e7eb" }}>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && sendMessage()}
              placeholder="Ask about finances or say 'spent 200 on food'..."
              style={{ flex:1, padding:"12px 16px", borderRadius:10, border:"0.5px solid #d1d5db", fontSize:14, outline:"none" }}
            />
            <button onClick={() => sendMessage()} disabled={loading} style={{ padding:"12px 22px", background:"#0D9488", color:"white", border:"none", borderRadius:10, fontSize:14, fontWeight:500, cursor:"pointer" }}>Send</button>
          </div>
        </div>
      )}

      {/* TRANSACTIONS TAB - Shows ALL transactions */}
      {tab === "transactions" && (
        <div style={{ maxWidth:900, margin:"0 auto", padding:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <p style={{ margin:0, fontWeight:600, fontSize:20 }}>All Transactions</p>
            <p style={{ margin:0, fontSize:14, color:"#6b7280" }}>Total: {transactions.length} transactions</p>
          </div>
          
          {transactions.length === 0 ? (
            <div style={{ background:"white", borderRadius:14, padding:40, textAlign:"center", border:"0.5px solid #e5e7eb" }}>
              <p style={{ color:"#9ca3af", margin:0 }}>No transactions yet. Upload a CSV or add expenses via chat.</p>
            </div>
          ) : (
            <TransactionFeed transactions={transactions} limit={null} />
          )}
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === "settings" && (
        <div style={{ maxWidth:600, margin:"40px auto", padding:"0 24px" }}>
          <p style={{ margin:"0 0 20px", fontWeight:600, fontSize:18 }}>Settings</p>

          <div style={{ background:"white", borderRadius:14, padding:24, border:"0.5px solid #e5e7eb", marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <p style={{ margin:"0 0 4px", fontWeight:600, fontSize:15 }}>Daily email reminders</p>
                <p style={{ margin:"0 0 12px", fontSize:13, color:"#6b7280", lineHeight:1.6 }}>
                  Get a personalised email every morning at 8:00 AM with your savings target, goal progress, and spending alerts.
                </p>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {["Today's savings target","Goal progress bar","Top spending category alert"].map(f => (
                    <span key={f} style={{ background:"#ECFDF5", color:"#0D9488", fontSize:11, fontWeight:500, padding:"3px 10px", borderRadius:20, border:"0.5px solid #6EE7B7" }}>{f}</span>
                  ))}
                </div>
              </div>
              <button onClick={toggleEmail} disabled={emailLoading} style={{
                padding:"10px 20px", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", border:"none", flexShrink:0, marginLeft:16,
                background:emailEnabled?"#FEF2F2":"#0D9488",
                color:emailEnabled?"#ef4444":"white",
              }}>
                {emailLoading ? "..." : emailEnabled ? "Disable" : "Enable"}
              </button>
            </div>
            {emailEnabled && (
              <div style={{ marginTop:16, padding:"12px 16px", background:"#ECFDF5", borderRadius:10, fontSize:13, color:"#0D9488" }}>
                ✓ Daily reminders active · A confirmation email was sent to {user?.email}
              </div>
            )}
          </div>

          <div style={{ background:"white", borderRadius:14, padding:24, border:"0.5px solid #e5e7eb" }}>
            <p style={{ margin:"0 0 4px", fontWeight:600, fontSize:15 }}>Account</p>
            <p style={{ margin:"0 0 12px", fontSize:13, color:"#6b7280" }}>Logged in as {user?.email}</p>
            <button onClick={onLogout} style={{ padding:"9px 20px", background:"#fef2f2", border:"0.5px solid #fca5a5", borderRadius:9, fontSize:13, color:"#ef4444", cursor:"pointer" }}>
              Log out
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState("home");

  useEffect(() => {
    if (getToken()) setScreen("dashboard");
  }, []);

  const handleAuthSuccess = () => setScreen("onboard");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setScreen("home");
  };

  if (screen === "home") return <HomePage onLogin={() => setScreen("login")} onSignup={() => setScreen("signup")} />;
  if (screen === "login") return <AuthScreen mode="login" onSuccess={() => setScreen("dashboard")} onSwitch={() => setScreen("signup")} />;
  if (screen === "signup") return <AuthScreen mode="signup" onSuccess={handleAuthSuccess} onSwitch={() => setScreen("login")} />;
  if (screen === "onboard") return <OnboardScreen onDone={() => setScreen("upload")} />;
  if (screen === "upload") return <UploadScreen onDone={() => setScreen("dashboard")} />;
  if (screen === "dashboard") return <Dashboard onLogout={handleLogout} />;
}