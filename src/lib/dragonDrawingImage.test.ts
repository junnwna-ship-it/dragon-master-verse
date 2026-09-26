import { afterEach, describe, expect, it, vi } from "vitest";
import {
  centeredSquareCrop,
  drawingGeometry,
  FULL_DRAWING_CROP,
  loadDrawing,
  type DrawingRotation,
} from "./dragonDrawingImage";

afterEach(() => vi.unstubAllGlobals());

describe("drawing crop and rotation geometry", () => {
  it.each([0, 90, 180, 270] as DrawingRotation[])(
    "crops the displayed edges after %i degree rotation",
    (rotation) => {
      const result = drawingGeometry(
        { width: 1200, height: 800 },
        { rotation, crop: { left: 10, right: 20, top: 25, bottom: 0 } },
      );
      const sideways = rotation === 90 || rotation === 270;
      expect(result).toMatchObject(
        sideways
          ? {
              frameWidth: 800,
              frameHeight: 1200,
              x: 80,
              y: 300,
              width: 560,
              height: 900,
              outputWidth: 560,
              outputHeight: 900,
            }
          : {
              frameWidth: 1200,
              frameHeight: 800,
              x: 120,
              y: 200,
              width: 840,
              height: 600,
              outputWidth: 840,
              outputHeight: 600,
            },
      );
    },
  );

  it("bounds large output, keeps aspect ratio and never enlarges a small drawing", () => {
    expect(
      drawingGeometry({ width: 6000, height: 4000 }, { rotation: 0, crop: FULL_DRAWING_CROP }),
    ).toMatchObject({ outputWidth: 1600, outputHeight: 1067 });
    expect(
      drawingGeometry({ width: 100, height: 80 }, { rotation: 90, crop: FULL_DRAWING_CROP }, 720),
    ).toMatchObject({ outputWidth: 80, outputHeight: 100 });
  });

  it.each([0, 90, 180, 270] as DrawingRotation[])(
    "centers a square without stretching at %i degrees",
    (rotation) => {
      const size = { width: 4032, height: 3024 };
      const crop = centeredSquareCrop(size, rotation);
      const result = drawingGeometry(size, { rotation, crop });
      expect(result.width).toBe(3024);
      expect(result.height).toBe(3024);
      expect(result.outputWidth).toBe(result.outputHeight);
      expect(crop.left).toBe(crop.right);
      expect(crop.top).toBe(crop.bottom);
    },
  );

  it.each([
    { left: 50, right: 50, top: 0, bottom: 0 },
    { left: 0, right: 0, top: 100, bottom: 1 },
    { left: -1, right: 0, top: 0, bottom: 0 },
    { left: NaN, right: 0, top: 0, bottom: 0 },
    { left: 0, right: Infinity, top: 0, bottom: 0 },
  ])("rejects empty or invalid crop areas: %j", (crop) => {
    expect(() => drawingGeometry({ width: 1000, height: 600 }, { rotation: 0, crop })).toThrow();
  });

  it("keeps a tiny valid crop at least one pixel and rejects invalid image sizes", () => {
    expect(
      drawingGeometry(
        { width: 1, height: 1 },
        { rotation: 0, crop: { left: 49, right: 50, top: 49, bottom: 50 } },
      ),
    ).toMatchObject({ width: 1, height: 1 });
    for (const width of [0, -1, NaN, Infinity, 1.5, 40_000_001]) {
      expect(() =>
        drawingGeometry({ width, height: 1 }, { rotation: 0, crop: FULL_DRAWING_CROP }),
      ).toThrow();
    }
  });
});

describe("drawing decode failures and orientation", () => {
  it("requests EXIF orientation and releases decoded bitmap memory", async () => {
    const bitmap = { width: 800, height: 1200, close: vi.fn() };
    const decode = vi.fn().mockResolvedValue(bitmap);
    vi.stubGlobal("createImageBitmap", decode);
    const original = new Blob(["fixture"], { type: "image/jpeg" });
    const image = await loadDrawing(original);
    expect(decode).toHaveBeenCalledWith(original, { imageOrientation: "from-image" });
    expect(image).toMatchObject({ width: 800, height: 1200 });
    image.close();
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it("rejects an undecodable image even if its MIME type says it is a photo", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("invalid image")));
    await expect(loadDrawing(new Blob(["not an image"], { type: "image/png" }))).rejects.toThrow(
      "그림을 읽지 못했습니다",
    );
  });

  it("releases decoded memory when an image exceeds the pixel limit", async () => {
    const bitmap = { width: 9000, height: 6000, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    await expect(loadDrawing(new Blob(["fixture"], { type: "image/jpeg" }))).rejects.toThrow(
      "4천만",
    );
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
