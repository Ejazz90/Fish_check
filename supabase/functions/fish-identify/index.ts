import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sign-in required." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Your session is not valid. Please sign in again." }, 401);

    const { image_url } = await req.json();
    if (typeof image_url !== "string" || !image_url.startsWith("https://")) {
      return json({ error: "A valid uploaded image is required." }, 400);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "AI service is not configured yet." }, 500);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 450,
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `Identify the fish in this image. Return JSON only with keys: species (best common name, or "Unknown fish"), scientific_name (string or empty), confidence (one of "high", "medium", "low"), notes (brief visual clues and any ambiguity). Do not claim certainty if the image is unclear. If this may be a fish but cannot be identified, say Unknown fish and explain what extra angle or detail would help. Do not infer catch location.` },
            { type: "image_url", image_url: { url: image_url, detail: "high" } }
          ]
        }]
      })
    });
    const result = await response.json();
    if (!response.ok) return json({ error: result?.error?.message || "The AI identification request failed." }, 502);
    const content = result?.choices?.[0]?.message?.content;
    if (!content) return json({ error: "The AI did not return an identification." }, 502);
    return json(JSON.parse(content));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected server error." }, 500);
  }
});
