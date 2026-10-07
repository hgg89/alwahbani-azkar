import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { message, previous_response_id } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "الرسالة مطلوبة" });
    }

    const instructions = `أنت "الوهباني AI"، مساعد عربي داخل تطبيق "الوهباني | أذكاري".
تحدث بالعربية وبأسلوب لطيف وواضح.
ساعد المستخدم في الأذكار والذكر والمعاني العامة المتعلقة بها، وأجب التحيات والأسئلة العامة باحترام.
لا تخترع آيات أو أحاديث أو فضائل من عندك. إذا لم تكن متأكدًا من نسبة نص شرعي، قل ذلك بوضوح.
لا تقدّم فتوى ملزمة أو حكمًا شرعيًا متخصصًا على أنه يقين؛ في المسائل الفقهية المتخصصة وجّه المستخدم إلى عالم موثوق.
عند طلب أذكار موجودة في التطبيق، يمكن اقتراح فتح القسم المناسب.
اجعل الإجابات عملية ومختصرة ما لم يطلب المستخدم التفصيل.`;

    const params = {
      model: "gpt-6-astra",
      instructions,
      input: message
    };
    if (previous_response_id) params.previous_response_id = previous_response_id;

    const response = await client.responses.create(params);
    return res.status(200).json({
      response_id: response.id,
      text: response.output_text || "عذرًا، لم أتمكن من توليد رد."
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "تعذر الاتصال بخدمة الذكاء الاصطناعي." });
  }
}
