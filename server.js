import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || "change-me";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

// Conversation memory is kept in RAM only; no API key is ever sent to the browser.
const conversations = new Map();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const settings = {
  ai: true, tasbih: true, favorites: true, search: true, reminders: true,
  vibration: true, nightMode: true, fontControls: true,
  welcome: "السلام عليكم ورحمة الله وبركاته 🌿\nأنا الوهباني AI. اسألني عن الأذكار أو أي سؤال عام.",
  subtitle: "رفيقك اليومي للذكر والطمأنينة ✨"
};

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

function sign(value) {
  return crypto.createHmac("sha256", ADMIN_TOKEN_SECRET).update(value).digest("hex");
}
function adminToken() {
  const stamp = String(Date.now());
  return stamp + "." + sign(stamp);
}
function isAdmin(req) {
  const raw = req.headers.authorization?.replace("Bearer ", "");
  if (!raw) return false;
  const [stamp, sig] = raw.split(".");
  return !!stamp && sig === sign(stamp) && Date.now() - Number(stamp) < 86400000;
}

app.get("/health", (_req, res) => res.json({
  ok: true,
  app: "الوهباني | أذكاري",
  ai: !!process.env.GEMINI_API_KEY,
  provider: "Gemini",
  model: GEMINI_MODEL
}));

app.post("/api/admin/login", (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "لوحة المشرف غير مهيأة." });
  if (req.body?.password !== ADMIN_PASSWORD) return res.status(401).json({ error: "كلمة مرور المشرف غير صحيحة." });
  res.json({ token: adminToken() });
});

app.get("/api/admin/settings", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "غير مصرح." });
  res.json(settings);
});

app.post("/api/admin/settings", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "غير مصرح." });
  const allowed = ["ai","tasbih","favorites","search","reminders","vibration","nightMode","fontControls","welcome","subtitle"];
  for (const key of allowed) if (key in req.body) {
    if (typeof req.body[key] === "boolean" && key !== "welcome" && key !== "subtitle") settings[key] = req.body[key];
    if ((key === "welcome" || key === "subtitle") && typeof req.body[key] === "string") settings[key] = req.body[key].slice(0, 500);
  }
  res.json(settings);
});

app.get("/api/settings", (_req, res) => res.json(settings));

app.post("/api/chat", async (req, res) => {
  try {
    if (!settings.ai) return res.status(403).json({ error: "ميزة الذكاء الاصطناعي متوقفة من لوحة المشرف." });
    if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "مفتاح Gemini المجاني غير مضاف إلى الخادم بعد." });

    const { message, previous_response_id } = req.body || {};
    if (!message || typeof message !== "string") return res.status(400).json({ error: "الرسالة مطلوبة" });

    const instructions = `أنت "الوهباني AI"، مساعد عربي داخل تطبيق "الوهباني | أذكاري".
تحدث بالعربية بلطف ووضوح، وافهم التحيات والأسئلة العامة ولا تحصر إجاباتك في أسماء الأذكار فقط.
ساعد المستخدم في أذكار الصباح والمساء وبعد الصلاة والنوم والأذكار المتنوعة، واشرح المعنى العام للذكر.
يمكنك الإجابة عن مثل: السلام عليكم، صباح الخير، كيف حالك، ما تاريخ اليوم، وما الذكر المناسب عند الخوف.
لا تخترع آيات أو أحاديث أو فضائل دينية. إذا لم تتأكد من نسبة نص شرعي فقل بوضوح إنك غير متأكد ولا تنسبه للنبي ﷺ.
لا تقدّم فتوى متخصصة على أنها يقين؛ في المسائل الفقهية المتخصصة وجّه المستخدم إلى عالم موثوق.
لا تدّعي أنك إنسان أو عالم دين. يمكنك اقتراح أقسام التطبيق المناسبة.
إذا سأل المستخدم عن شيء خارج الأذكار، أجب بشكل طبيعي ما دام مناسبًا وآمنًا.`;

    const sessionId = typeof previous_response_id === "string" && previous_response_id.length
      ? previous_response_id.slice(0, 100)
      : crypto.randomUUID();

    const history = conversations.get(sessionId) || [];
    history.push({ role: "user", parts: [{ text: message.slice(0, 4000) }] });

    // Keep the free-tier request small and predictable.
    const recentHistory = history.slice(-12);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions }] },
          contents: recentHistory,
          generationConfig: { temperature: 0.6, maxOutputTokens: 700 }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", response.status, data);
      return res.status(response.status >= 500 ? 502 : response.status).json({
        error: "تعذر الاتصال بخدمة Gemini المجانية."
      });
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!text) return res.status(502).json({ error: "لم يصل رد من الذكاء الاصطناعي." });

    history.push({ role: "model", parts: [{ text }] });
    conversations.set(sessionId, history.slice(-12));

    // Return the session id using the existing frontend field name.
    res.json({ response_id: sessionId, text });
  } catch (error) {
    console.error("Gemini error:", error);
    res.status(500).json({ error: "تعذر الاتصال بخدمة الذكاء الاصطناعي." });
  }
});

app.get("/admin", (_req, res) => res.sendFile(path.join(__dirname, "admin.html")));
app.listen(port, () => console.log(`الوهباني | أذكاري يعمل على المنفذ ${port}`));
