// Cloudflare Worker: keeps the Anthropic API key on the server (never in the browser).
// Secrets/vars:  ANTHROPIC_API_KEY (secret, required) · ALLOWED_ORIGIN (your site origin, strongly recommended) · MODEL (optional)
const SYSTEM = `أنت مساعد زراعي لمنصة Field Shift في مصر. رد بالعربية المصرية البسيطة، بإيجاز وبشكل عملي (٤–٦ أسطر كحد أقصى)، كأنك بتكلم مزارع.
قواعد صارمة:
- استخدم فقط بيانات السياق المرفقة (الطقس، التوقعات، حسابات الري، التنبيهات). لا تخترع أرقامًا أبدًا.
- ميّز بين: بيانات حقيقية من API، توقعات، قيم محسوبة، وافتراضات/تقديرات (السياق بيذكر المصدر لكل جزء). قل "غير متاح" لو المعلومة مش موجودة (مثلًا NDVI الرقمي).
- لو معلومة ناقصة، اسأل سؤال توضيحي واحد قصير.
- لا تشخّص أمراض النبات من وصف فقط؛ اذكر الاحتمالات الشائعة وانصح بعرض صور على مهندس زراعي.
- لا تعطِ جرعات مبيدات أو أسمدة محددة؛ انصح بتحليل التربة ومهندس زراعي.
- النتائج إرشادية وليست وعودًا.
السياق (JSON):
`;

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "*";
    const h = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: h });
    if (req.method !== "POST") return new Response("{}", { status: 405, headers: h });
    if (allowed !== "*" && origin !== allowed) return new Response('{"error":"origin not allowed"}', { status: 403, headers: h });
    if (!env.ANTHROPIC_API_KEY) return new Response('{"error":"server not configured"}', { status: 500, headers: h });

    let b;
    try { b = await req.json(); } catch { return new Response('{"error":"bad json"}', { status: 400, headers: h }); }
    let m = (b.messages || []).slice(-10)
      .filter(x => x && typeof x.content === "string" && (x.role === "user" || x.role === "assistant"))
      .map(x => ({ role: x.role, content: x.content.slice(0, 1500) }));
    while (m.length && m[0].role !== "user") m.shift();
    if (!m.length) return new Response('{"error":"no message"}', { status: 400, headers: h });

    const system = SYSTEM + JSON.stringify(b.context || null).slice(0, 6000);
    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: env.MODEL || "claude-sonnet-5-5", max_tokens: 700, system, messages: m }),
      });
    } catch { return new Response('{"error":"upstream unreachable"}', { status: 502, headers: h }); }
    if (!r.ok) return new Response('{"error":"upstream"}', { status: 502, headers: h });
    const j = await r.json();
    return new Response(JSON.stringify({ reply: (j.content || []).filter(c => c.type === "text").map(c => c.text).join("\n") }), { headers: h });
  },
};
