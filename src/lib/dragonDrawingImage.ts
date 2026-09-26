export type DrawingRotation = 0 | 90 | 180 | 270;

/** Percentages trimmed from the edges of the image AFTER rotation. */
export interface DrawingCrop {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface DrawingEdit {
  rotation: DrawingRotation;
  crop: DrawingCrop;
}

export const FULL_DRAWING_CROP: Readonly<DrawingCrop> = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};
export const ORIGINAL_DRAWING_EDIT: Readonly<DrawingEdit> = {
  rotation: 0,
  crop: FULL_DRAWING_CROP,
};

interface DrawingSize {
  width: number;
  height: number;
}

export interface LoadedDrawing extends DrawingSize {
  source: CanvasImageSource;
  close: () => void;
}

function validateSize({ width, height }: DrawingSize) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > 40_000_000
  ) {
    throw new Error("이미지를 읽을 수 없거나 너무 큽니다. 4천만 화소 이하의 그림을 사용해 주세요.");
  }
}

export function drawingGeometry(size: DrawingSize, edit: DrawingEdit, maxEdge = 1600) {
  validateSize(size);
  if (![0, 90, 180, 270].includes(edit.rotation)) throw new Error("회전 방향이 올바르지 않습니다.");
  const { left, right, top, bottom } = edit.crop;
  if (
    ![left, right, top, bottom].every((value) => Number.isFinite(value) && value >= 0) ||
    left + right >= 100 ||
    top + bottom >= 100 ||
    !Number.isSafeInteger(maxEdge) ||
    maxEdge < 1 ||
    maxEdge > 1600
  ) {
    throw new Error("그림이 남도록 자를 범위를 조절해 주세요.");
  }
  const sideways = edit.rotation === 90 || edit.rotation === 270;
  const frameWidth = sideways ? size.height : size.width;
  const frameHeight = sideways ? size.width : size.height;
  const x = Math.min(frameWidth - 1, Math.round((frameWidth * left) / 100));
  const y = Math.min(frameHeight - 1, Math.round((frameHeight * top) / 100));
  const width = Math.max(1, Math.round(frameWidth * (1 - right / 100)) - x);
  const height = Math.max(1, Math.round(frameHeight * (1 - bottom / 100)) - y);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    frameWidth,
    frameHeight,
    x,
    y,
    width,
    height,
    outputWidth: Math.max(1, Math.round(width * scale)),
    outputHeight: Math.max(1, Math.round(height * scale)),
  };
}

export function centeredSquareCrop(size: DrawingSize, rotation: DrawingRotation): DrawingCrop {
  const { frameWidth, frameHeight } = drawingGeometry(size, { rotation, crop: FULL_DRAWING_CROP });
  const side = Math.min(frameWidth, frameHeight);
  const horizontal = ((frameWidth - side) / frameWidth) * 50;
  const vertical = ((frameHeight - side) / frameHeight) * 50;
  return { left: horizontal, right: horizontal, top: vertical, bottom: vertical };
}

/** Decode EXIF orientation once, then work in upright image coordinates. */
export async function loadDrawing(source: Blob | string): Promise<LoadedDrawing> {
  if (typeof source !== "string" && typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
    } catch {
      throw new Error("그림을 읽지 못했습니다. PNG, JPG 또는 WEBP 파일을 다시 선택해 주세요.");
    }
    try {
      validateSize(bitmap);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch (error) {
      bitmap.close();
      throw error;
    }
  }
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  const close = () => {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  };
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () =>
        reject(new Error("그림을 읽지 못했습니다. 다른 파일을 선택해 주세요."));
      element.src = url;
    });
    const size = { width: image.naturalWidth, height: image.naturalHeight };
    validateSize(size);
    return { ...size, source: image, close };
  } catch (error) {
    close();
    throw error;
  }
}

/** Draw straight to a bounded output canvas; no full-resolution rotated copy is allocated. */
export function renderDrawing(
  canvas: HTMLCanvasElement,
  image: LoadedDrawing,
  edit: DrawingEdit = ORIGINAL_DRAWING_EDIT,
  maxEdge = 1600,
  filter = "none",
) {
  const geometry = drawingGeometry(image, edit, maxEdge);
  canvas.width = geometry.outputWidth;
  canvas.height = geometry.outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이 브라우저에서 그림을 편집할 수 없습니다.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.scale(canvas.width / geometry.width, canvas.height / geometry.height);
  context.translate(geometry.frameWidth / 2 - geometry.x, geometry.frameHeight / 2 - geometry.y);
  context.rotate((edit.rotation * Math.PI) / 180);
  context.filter = filter;
  context.imageSmoothingQuality = "high";
  context.drawImage(image.source, -image.width / 2, -image.height / 2, image.width, image.height);
  context.restore();
  return geometry;
}

export async function exportDrawing(
  image: LoadedDrawing,
  edit: DrawingEdit = ORIGINAL_DRAWING_EDIT,
  maxEdge = 1600,
  filter = "none",
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  try {
    renderDrawing(canvas, image, edit, maxEdge, filter);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob && blob.size > 0 && blob.size <= 8 * 1024 * 1024
            ? resolve(blob)
            : reject(
                new Error("편집한 그림을 저장하지 못했습니다. 범위를 줄여 다시 시도해 주세요."),
              ),
        "image/jpeg",
        0.92,
      );
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function imageToJpeg(source: Blob | string, filter = "none"): Promise<Blob> {
  const image = await loadDrawing(source);
  try {
    return await exportDrawing(image, ORIGINAL_DRAWING_EDIT, 720, filter);
  } finally {
    image.close();
  }
}
