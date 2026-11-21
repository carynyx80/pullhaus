import { config } from "./config.js";

type ChatMessage = { role: "system" | "user"; content: string };

async function chat(messages: ChatMessage[]): Promise<string | null> {
  if (!config.openaiKey) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openaiTextModel,
      temperature: 0.8,
      messages,
    }),
  });
  if (!response.ok) throw new Error(`openai chat ${response.status}`);
  const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() || null;
}

export async function enhanceLore(prompt: string): Promise<string | null> {
  try {
    return await chat([
      {
        role: "system",
        content:
          "You write two-sentence card lore for a sealed-card atelier. Sensory, specific, no investment language, no promises of profit. Reply with the lore only.",
      },
      { role: "user", content: prompt },
    ]);
  } catch (error) {
    console.warn("lore generation failed", error);
    return null;
  }
}

export async function narrateBattle(facts: string): Promise<string | null> {
  try {
    return await chat([
      {
        role: "system",
        content:
          "Rewrite the battle as five short sentences, one per round, in the same order. Do not change who wins a round or the match. No gambling language. Reply with the sentences only.",
      },
      { role: "user", content: facts },
    ]);
  } catch (error) {
    console.warn("narration failed", error);
    return null;
  }
}

export async function generateImage(prompt: string): Promise<Buffer | null> {
  if (!config.openaiKey) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openaiImageModel,
        prompt,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });
    if (!response.ok) throw new Error(`openai image ${response.status}`);
    const json = (await response.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    return b64 ? Buffer.from(b64, "base64") : null;
  } catch (error) {
    console.warn("image generation failed", error);
    return null;
  }
}
