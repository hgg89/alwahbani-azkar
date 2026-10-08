import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { message, previous_response_id } = req.body || {};
    if (!message || typeof message !== "string") return res.status(400).json({ error: "الرسالة مطلوبة" });
    const instructions = `أنت "الوهباني AI"، مساعد عربي داخل تطبيق "الوهباني | أذكاري".
تحدث بالعربية بلطف ووضوح. أجب التحيات والأسئلة العامة، وساعد في الأذكار والذكر ومعانيهما العامة.
لا تخترع آيات أو أحاديث أو فضائل. إذا لم تتأكد من نسبة نص شرعي فاذكر عدم التأكد.
لا تقدّم فتوى متخصصة على أنها يقين؛ في المسائل الفقهية المتخصصة وجّه المستخدم إلى عالم موثوق.
يمكنك اقتراح أقسام التطبيق المناسبة. لا تدّعي أنك إنسان أو عالم دين.`;
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      instructions,
      input: message,
      ...(previous_response_id ? { previous_response_id } : {})
    });
    return res.status(200).json({ response_id: response.id, text: response.output_text || "عذرًا، لم أتمكن من توليد رد." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "تعذر الاتصال بخدمة الذكاء الاصطناعي." });
  }
}
