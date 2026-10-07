import express from "express";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "الوهباني | أذكاري" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, previous_response_id } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "الرسالة مطلوبة" });
    }

    const instructions = `أنت "الوهباني AI"، مساعد عربي داخل تطبيق "الوهباني | أذكاري".
تحدث بالعربية وبأسلوب لطيف وواضح.
أجب التحيات والأسئلة العامة باحترام، وساعد في الأذكار والذكر ومعانيهما العامة.
لا تخترع آيات أو أحاديث أو فضائل. إذا لم تكن متأكدًا من نسبة نص شرعي فاذكر عدم التأكد بوضوح.
لا تقدّم فتوى متخصصة على أنها يقين؛ في المسائل الفقهية المتخصصة وجّه المستخدم إلى عالم موثوق.
إذا سأل المستخدم عن محتوى التطبيق، ساعده في الوصول إلى القسم المناسب.
اجعل الإجابات عملية ومختصرة ما لم يطلب المستخدم التفصيل.`;

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-6-luna",
      instructions,
      input: message,
      ...(previous_response_id ? { previous_response_id } : {})
    });

    res.json({
      response_id: response.id,
      text: response.output_text || "عذرًا، لم أتمكن من توليد رد."
    });
  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: "تعذر الاتصال بخدمة الذكاء الاصطناعي." });
  }
});

app.listen(port, () => {
  console.log(`الوهباني | أذكاري يعمل على المنفذ ${port}`);
});
