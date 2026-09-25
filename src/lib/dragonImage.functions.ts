import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CleanDragonDrawingInput = z.object({
  imageBase64: z.string().min(100).max(8_000_000),
});

function decodeImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("PNG, JPG 또는 WEBP 이미지를 사용해 주세요.");
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, mime: match[1]! };
}

/**
 * Turns a photographed hand drawing into clean game-card art. The API key is
 * read only on the server; the browser never receives it.
 */
export const cleanDragonDrawing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CleanDragonDrawingInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("AI 그림 정돈 기능이 아직 서버에 연결되지 않았습니다.");

    const { bytes, mime } = decodeImage(data.imageBase64);
    const form = new FormData();
    form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-sunburst");
    form.append("image", new Blob([bytes], { type: mime }), `dragon-drawing.${mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg"}`);
    form.append(
      "prompt",
      [
        "Clean up this hand-drawn dragon into a polished, child-friendly fantasy game portrait.",
        "Preserve the child's original dragon exactly: keep its pose, silhouette, horn count, wing shape, face, markings, proportions, and personality.",
        "Straighten and clarify the drawn lines, remove paper shadows, fingers, desk objects, and camera perspective distortion.",
        "Add gentle color and shading only where the drawing leaves room; do not replace the creature with a different dragon.",
        "Place the dragon centered on a simple warm magical hatchery background, with a square card-safe composition.",
        "No text, no logo, no watermark, no extra characters, no frightening details.",
      ].join(" "),
    );
    form.append("size", "1024x1024");
    form.append("quality", "medium");
    form.append("output_format", "jpeg");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (response.status === 429) throw new Error("AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.");
    if (!response.ok) {
      const detail = await response.text();
      console.error("[dragon-image] OpenAI edit failed:", response.status, detail.slice(0, 1000));
      throw new Error(response.status === 401 ? "AI 이미지 서버 인증을 확인해 주세요." : "AI가 그림을 정돈하지 못했습니다.");
    }

    const result = (await response.json()) as { data?: Array<{ b64_json?: string }> };
    const base64 = result.data?.[0]?.b64_json;
    if (!base64) throw new Error("AI 이미지 결과가 비어 있습니다.");
    return { imageBase64: `data:image/jpeg;base64,${base64}` };
  });
