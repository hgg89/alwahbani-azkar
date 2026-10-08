import express from "express";
import OpenAI from "openai";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || "change-me";

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

app.get("/health", (_req, res) => res.json({ ok: true, app: "الوهباني | أذكاري", ai: !!process.env.OPENAI_API_KEY }));

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
    const { message, previous_response_id } = req.body || {};
    if (!message || typeof message !== "string") return res.status(400).json({ error: "الرسالة مطلوبة" });

    const instructions = `أنت "الوهباني AI"، مساعد عربي داخل تطبيق "الوهباني | أذكاري".
تحدث بالعربية بلطف ووضوح. أجب التحيات والأسئلة العامة، وساعد في الأذكار والذكر ومعانيهما العامة.
لا تخترع آيات أو أحاديث أو فضائل. إذا لم تتأكد من نسبة نص شرعي فاذكر عدم التأكد.
لا تقدّم فتوى متخصصة على أنها يقين؛ في المسائل الفقهية المتخصصة وجّه المستخدم إلى عالم موثوق.
يمكنك اقتراح أقسام التطبيق المناسبة. لا تدّعي أنك إنسان أو عالم دين.`;

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      instructions,
      input: message,
      ...(previous_response_id ? { previous_response_id } : {})
    });

    res.json({ response_id: response.id, text: response.output_text || "عذرًا، لم أتمكن من توليد رد." });
  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: "تعذر الاتصال بخدمة الذكاء الاصطناعي." });
  }
});

app.get("/admin", (_req, res) => res.sendFile(path.join(__dirname, "admin.html")));
app.listen(port, () => console.log(`الوهباني | أذكاري يعمل على المنفذ ${port}`));
