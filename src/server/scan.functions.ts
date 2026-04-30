import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ScanInput = z.object({
  imageBase64: z.string().min(100).max(15_000_000), // data URL or base64
});

const ELEMENTS = ["Wood", "Water", "Fire", "Earth", "Metal"] as const;

export const recognizeCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ScanInput.parse(input))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) {
      throw new Error("AI 게이트웨이가 구성되지 않았습니다.");
    }

    // Normalize to a data URL
    const dataUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:image/jpeg;base64,${data.imageBase64}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You analyze trading-card-game dragon cards. Always respond by calling the extract_card tool. " +
              "Pick the most plausible values from the image. If unreadable, infer reasonable defaults but " +
              "lower the confidence. Stat total should be roughly 150 (HP+MP+ATK+DEF).",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "이 드래곤 카드를 분석해서 이름/속성/스탯을 추출하세요." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_card",
              description: "Extract dragon card metadata.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Dragon name" },
                  element: { type: "string", enum: ELEMENTS },
                  hp: { type: "integer", minimum: 10, maximum: 120 },
                  mp: { type: "integer", minimum: 10, maximum: 120 },
                  atk: { type: "integer", minimum: 10, maximum: 120 },
                  def: { type: "integer", minimum: 10, maximum: 120 },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                },
                required: ["name", "element", "hp", "mp", "atk", "def", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_card" } },
      }),
    });

    if (response.status === 429) throw new Error("AI 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
    if (response.status === 402) throw new Error("AI 크레딧이 부족합니다. 워크스페이스 결제를 확인하세요.");
    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("카드 인식에 실패했습니다.");
    }

    const json = await response.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("AI 응답을 해석할 수 없습니다.");
    const parsed = JSON.parse(call.function.arguments);

    return {
      name: String(parsed.name).slice(0, 40),
      element: ELEMENTS.includes(parsed.element) ? parsed.element : "Wood",
      hp: Math.round(parsed.hp),
      mp: Math.round(parsed.mp),
      atk: Math.round(parsed.atk),
      def: Math.round(parsed.def),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    };
  });