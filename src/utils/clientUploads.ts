"use client";

import {
  PORTFOLIO_MEDIA_LIMITS,
  maxBytesFor,
  type PortfolioAssetKind,
} from "@/utils/portfolioMedia";
import { MAX_PROFILE_IMAGE_UPLOAD_BYTES } from "@/utils/portfolio";

type PresignResponse = {
  uploadUrl: string;
  assetUrl: string;
  key: string;
  headers: Record<string, string>;
};

export type UploadedAsset = {
  url: string;
  kind: PortfolioAssetKind;
  bytes: number;
  durationSeconds?: number;
  aspectRatio?: number;
  posterUrl?: string;
  peaks?: number[];
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read the selected file."));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

async function presign(file: File, kind?: PortfolioAssetKind): Promise<PresignResponse | null> {
  const response = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      purpose: "portfolio",
      ...(kind ? { kind } : {}),
    }),
  });

  if (response.status === 503) {
    // Object storage is unavailable. Images can still be held inline; anything
    // heavier genuinely cannot, and the server says so in its message.
    if (kind && kind !== "image") {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Uploads are unavailable in this environment.");
    }
    return null;
  }

  const data = (await response.json()) as Partial<PresignResponse> & { message?: string };
  if (!response.ok || !data.uploadUrl || !data.assetUrl || !data.key) {
    throw new Error(data.message || "The file could not be prepared for upload.");
  }
  return data as PresignResponse;
}

/** Confirm the upload so the server can verify its bytes before it is used. */
async function commit(key: string): Promise<void> {
  const response = await fetch("/api/uploads/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || "The upload could not be confirmed.");
  }
}

/** Hand back a reservation whose transfer failed, so its bytes stop counting
 *  against the account's quota straight away rather than waiting for the
 *  sweeper. Best-effort: the caller is already reporting a failure. */
async function release(key: string): Promise<void> {
  await fetch("/api/uploads/commit", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  }).catch(() => undefined);
}

/** PUT the bytes, releasing the reservation if the transfer or confirmation
 *  does not complete. Shared so no upload path can forget to clean up. */
async function transfer(prepared: PresignResponse, file: File, failureMessage: string): Promise<void> {
  let upload: Response;
  try {
    upload = await fetch(prepared.uploadUrl, { method: "PUT", headers: prepared.headers, body: file });
  } catch (error) {
    await release(prepared.key);
    throw error instanceof Error ? error : new Error(failureMessage);
  }
  if (!upload.ok) {
    await release(prepared.key);
    throw new Error(failureMessage);
  }
  try {
    await commit(prepared.key);
  } catch (error) {
    await release(prepared.key);
    throw error;
  }
}

/** Existing image path, unchanged for every current caller. */
export async function uploadImage(file: File): Promise<string> {
  // Declares its kind so the server takes the quota-enforcing path. The server
  // still accepts kind-less requests for backward compatibility.
  const prepared = await presign(file, "image");
  if (!prepared) return readAsDataUrl(file);

  await transfer(prepared, file, "The image upload did not complete.");
  return prepared.assetUrl;
}

export function assetKindForFile(file: File): PortfolioAssetKind | null {
  for (const [kind, limit] of Object.entries(PORTFOLIO_MEDIA_LIMITS)) {
    if (limit.types[file.type]) return kind as PortfolioAssetKind;
  }
  return null;
}

/** Human-readable reason a file cannot be uploaded, or null when it can. */
export function describeUploadRejection(file: File): string | null {
  const kind = assetKindForFile(file);
  if (!kind) {
    return file.type.startsWith("video/")
      ? "That video format is not supported. Export it as MP4 or WebM, or paste a YouTube or Vimeo link instead."
      : "That file type is not supported.";
  }
  const maxBytes = maxBytesFor(kind, file.type);
  if (file.size > maxBytes) {
    const limit = PORTFOLIO_MEDIA_LIMITS[kind];
    return `${file.name} is larger than the ${Math.floor(maxBytes / 1024 / 1024)} MB limit for ${limit.label} files. Paste a link from a hosting platform for anything bigger.`;
  }
  return null;
}

function withObjectUrl<T>(file: File, read: (url: string) => Promise<T>): Promise<T> {
  const url = URL.createObjectURL(file);
  return read(url).finally(() => URL.revokeObjectURL(url));
}

export type CropAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImageForCrop(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!source.startsWith("data:") && !source.startsWith("blob:")) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This image could not be prepared for editing."));
    image.src = source;
  });
}

function rotateSize(width: number, height: number, rotation: number) {
  const radians = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height),
    height: Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height),
  };
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The edited image could not be encoded."));
    }, type, quality);
  });
}

/** Render the crop selected by react-easy-crop as the final upload file. */
export async function createCroppedProfileImage(
  source: string,
  crop: CropAreaPixels,
  rotation: number,
): Promise<File> {
  const image = await loadImageForCrop(source);
  const rotated = rotateSize(image.naturalWidth, image.naturalHeight, rotation);
  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = Math.max(1, Math.round(rotated.width));
  rotatedCanvas.height = Math.max(1, Math.round(rotated.height));
  const rotatedContext = rotatedCanvas.getContext("2d");
  if (!rotatedContext) throw new Error("Your browser could not prepare the edited image.");

  rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
  rotatedContext.rotate((rotation * Math.PI) / 180);
  rotatedContext.translate(-image.naturalWidth / 2, -image.naturalHeight / 2);
  rotatedContext.drawImage(image, 0, 0);

  const cropWidth = Math.max(1, Math.round(crop.width));
  const cropHeight = Math.max(1, Math.round(crop.height));
  const outputSize = Math.min(1200, cropWidth, cropHeight);
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputSize;
  outputCanvas.height = outputSize;
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) throw new Error("Your browser could not prepare the edited image.");

  outputContext.drawImage(
    rotatedCanvas,
    Math.max(0, Math.round(crop.x)),
    Math.max(0, Math.round(crop.y)),
    cropWidth,
    cropHeight,
    0,
    0,
    outputSize,
    outputSize,
  );

  const candidates = [
    { type: "image/webp", extension: "webp", quality: 0.9 },
    { type: "image/jpeg", extension: "jpg", quality: 0.86 },
    { type: "image/jpeg", extension: "jpg", quality: 0.72 },
  ];
  let lastBlob: Blob | null = null;
  let extension = "jpg";
  for (const candidate of candidates) {
    const blob = await canvasBlob(outputCanvas, candidate.type, candidate.quality);
    lastBlob = blob;
    extension = blob.type === "image/webp" ? "webp" : "jpg";
    if (blob.size <= MAX_PROFILE_IMAGE_UPLOAD_BYTES) break;
  }
  if (!lastBlob) throw new Error("The edited image could not be encoded.");
  return new File([lastBlob], `profile-photo.${extension}`, { type: lastBlob.type });
}

/** Grab a representative frame so video has a cover without a server render. */
async function captureVideoPoster(file: File): Promise<{ posterFile: File | null; durationSeconds?: number; aspectRatio?: number }> {
  return withObjectUrl(file, (url) => new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const give_up = () => resolve({ posterFile: null });
    const timer = window.setTimeout(give_up, 10_000);

    video.onerror = () => { window.clearTimeout(timer); give_up(); };
    video.onloadedmetadata = () => {
      // A frame a little way in avoids the black frame most videos open on.
      video.currentTime = Math.min(1, (video.duration || 2) / 4);
    };
    video.onseeked = () => {
      window.clearTimeout(timer);
      const durationSeconds = Number.isFinite(video.duration) ? Math.round(video.duration) : undefined;
      const aspectRatio = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : undefined;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(video.videoWidth || 1280, 1280);
        canvas.height = Math.round(canvas.width / (aspectRatio || 16 / 9));
        const context = canvas.getContext("2d");
        if (!context) return resolve({ posterFile: null, durationSeconds, aspectRatio });
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => resolve({
            posterFile: blob ? new File([blob], "poster.jpg", { type: "image/jpeg" }) : null,
            durationSeconds,
            aspectRatio,
          }),
          "image/jpeg",
          0.82,
        );
      } catch {
        // A cross-origin or DRM-protected frame taints the canvas. The video
        // still works; it just falls back to a generated cover.
        resolve({ posterFile: null, durationSeconds, aspectRatio });
      }
    };
    video.src = url;
  }));
}

/** Downsample the waveform in the browser so playback needs no server work. */
async function extractAudioPeaks(file: File, buckets = 120): Promise<{ peaks?: number[]; durationSeconds?: number }> {
  type WindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextClass = window.AudioContext || (window as WindowWithAudio).webkitAudioContext;
  if (!AudioContextClass) return {};

  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    const channel = decoded.getChannelData(0);
    const step = Math.floor(channel.length / buckets) || 1;
    const peaks: number[] = [];
    let loudest = 0;
    for (let bucket = 0; bucket < buckets; bucket += 1) {
      let peak = 0;
      const start = bucket * step;
      for (let index = start; index < start + step && index < channel.length; index += 1) {
        const amplitude = Math.abs(channel[index]);
        if (amplitude > peak) peak = amplitude;
      }
      peaks.push(peak);
      if (peak > loudest) loudest = peak;
    }
    // Normalize so quiet recordings still render a legible waveform.
    const scale = loudest > 0 ? 1 / loudest : 1;
    return {
      peaks: peaks.map((peak) => Math.round(Math.min(peak * scale, 1) * 100) / 100),
      durationSeconds: Math.round(decoded.duration),
    };
  } catch {
    return {};
  } finally {
    void context.close();
  }
}

async function putAndCommit(file: File, kind: PortfolioAssetKind): Promise<string | null> {
  const prepared = await presign(file, kind);
  if (!prepared) return null;
  await transfer(prepared, file, "The upload did not complete. Check your connection and try again.");
  return prepared.assetUrl;
}

/** Upload any supported media, deriving covers and waveforms in the browser. */
export async function uploadMedia(file: File): Promise<UploadedAsset> {
  const rejection = describeUploadRejection(file);
  if (rejection) throw new Error(rejection);
  const kind = assetKindForFile(file);
  if (!kind) throw new Error("That file type is not supported.");

  // Derive metadata before the upload so a long transfer is not wasted on a
  // file whose duration turns out to be over the limit.
  let durationSeconds: number | undefined;
  let aspectRatio: number | undefined;
  let peaks: number[] | undefined;
  let posterFile: File | null = null;

  if (kind === "video") {
    const captured = await captureVideoPoster(file);
    posterFile = captured.posterFile;
    durationSeconds = captured.durationSeconds;
    aspectRatio = captured.aspectRatio;
  } else if (kind === "audio") {
    const analysed = await extractAudioPeaks(file);
    peaks = analysed.peaks;
    durationSeconds = analysed.durationSeconds;
  }

  const maxDuration = PORTFOLIO_MEDIA_LIMITS[kind].maxDurationSeconds;
  if (maxDuration && durationSeconds && durationSeconds > maxDuration) {
    const minutes = Math.floor(maxDuration / 60);
    throw new Error(
      `That ${PORTFOLIO_MEDIA_LIMITS[kind].label} is longer than ${minutes} minute${minutes === 1 ? "" : "s"}. Paste a link from a hosting platform to share the full-length version.`,
    );
  }

  const url = await putAndCommit(file, kind);
  if (!url) throw new Error("Uploads are unavailable in this environment.");

  // A missing cover is cosmetic, so never fail the upload over one.
  let posterUrl: string | undefined;
  if (posterFile) {
    posterUrl = (await putAndCommit(posterFile, "image").catch(() => null)) || undefined;
  }

  return { url, kind, bytes: file.size, durationSeconds, aspectRatio, posterUrl, peaks };
}
