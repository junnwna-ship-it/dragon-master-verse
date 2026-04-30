import { useEffect, useState } from "react";
import type { Dragon } from "@/store/dragons";

/**
 * Renders a dragon's artwork with graceful fallback handling.
 * - If `dragon.image` is missing entirely → shows the icon/gradient fallback.
 * - If the image fails to load (network error, broken asset, decode failure)
 *   → swaps to the same fallback so we never leave a broken-image icon on screen.
 * Resets failure state when the dragon changes so a new card gets a fresh attempt.
 */
export function DragonImage({
  dragon,
  className = "",
  fit = "cover",
  sizes,
  loading = "lazy",
  fetchPriority,
  preferLarge = false,
  width,
  height,
}: {
  dragon: Dragon;
  className?: string;
  fit?: "cover" | "contain";
  sizes?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  /** Use the high-res variant as the primary `src` (modal hero). */
  preferLarge?: boolean;
  width?: number;
  height?: number;
}) {
  const [failed, setFailed] = useState(false);
  // Reset error state whenever we point at a different dragon/asset so a
  // transient network failure on one card doesn't permanently mask another.
  useEffect(() => {
    setFailed(false);
  }, [dragon.id, dragon.image, dragon.imageLarge, dragon.imageUrl]);

  // imageUrl(사용자 업로드 절대경로)가 있으면 최우선 사용.
  // 그 외에는 기존 webp 변형(작은/큰)을 사용.
  const primary = dragon.imageUrl
    ?? (preferLarge ? dragon.imageLarge ?? dragon.image : dragon.image);

  if (!primary || failed) {
    return (
      <div
        role="img"
        aria-label={`${dragon.name} 일러스트 (이미지 없음)`}
        className={`flex items-center justify-center bg-slate-700 ${className}`}
      >
        <span className="px-2 text-center text-sm font-bold tracking-wide text-slate-100">
          {dragon.name}
        </span>
      </div>
    );
  }

  return (
    <img
      src={primary}
      srcSet={
        // imageUrl 사용 중이면 srcSet 비활성화 (단일 자산).
        !dragon.imageUrl && dragon.image && dragon.imageLarge
          ? `${dragon.image} 480w, ${dragon.imageLarge} 800w`
          : undefined
      }
      sizes={sizes}
      alt={`${dragon.name} 일러스트`}
      className={`${fit === "cover" ? "object-cover" : "object-contain"} ${className}`}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      width={width}
      height={height}
      onError={() => setFailed(true)}
    />
  );
}