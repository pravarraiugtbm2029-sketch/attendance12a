exports.handler = async (event) => {
  const reply = (code, body) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (event.httpMethod !== "POST") return reply(405, { error: "Use POST" });

  const pass = process.env.ALERT_PASSCODE;
  if (pass && event.headers["x-alert-passcode"] !== pass) return reply(401, { error: "Wrong passcode" });

  const { WA_TOKEN, WA_PHONE_NUMBER_ID } = process.env;
  if (!WA_TOKEN || !WA_PHONE_NUMBER_ID) return reply(500, { error: "WA_TOKEN or WA_PHONE_NUMBER_ID not set in Netlify" });

  let d;
  try { d = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "Bad JSON" }); }
  const phone = String(d.phone || "").replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(phone)) return reply(400, { error: "Phone must be a 10-digit Indian mobile number" });
  const params = [d.name, d.roll, d.date, d.leave].map(v => String(v || "").slice(0, 100));
  if (params.some(v => !v)) return reply(400, { error: "Missing name, roll, date or leave" });

  const res = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: "91" + phone,
      type: "template",
      template: {
        name: process.env.WA_TEMPLATE || "absence_alert",
        language: { code: process.env.WA_LANG || "en" },
        components: [{ type: "body", parameters: params.map(text => ({ type: "text", text })) }]
      }
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return reply(502, { error: data.error?.message || "WhatsApp API error" });
  return reply(200, { status: "Sent", id: data.messages?.[0]?.id });
};
