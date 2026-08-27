"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Pencil, RotateCcw, RotateCw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Switch,
} from "@/components/ui";
import {
  createCroppedProfileImage,
  type CropAreaPixels,
} from "@/utils/clientUploads";
import {
  MAX_PROFILE_IMAGE_UPLOAD_BYTES,
  PROFILE_IMAGE_ASPECT_RATIO,
} from "@/utils/portfolio";

/* Validated portfolio uploads and remote image hosts cannot use a static Next image allowlist. */
/* eslint-disable @next/next/no-img-element */

type Props = {
  imageUrl: string;
  sourceImageUrl: string;
  name: string;
  showOnPortfolio: boolean;
  saving: boolean;
  onShowOnPortfolioChange: (show: boolean) => void;
  onUpload: (file: File, sourceFile?: File) => Promise<boolean>;
  onRemove: () => void;
};

const INITIAL_CROP: Point = { x: 0, y: 0 };

export default function StudioProfileImageEditor({
  imageUrl,
  sourceImageUrl,
  name,
  showOnPortfolio,
  saving,
  onShowOnPortfolioChange,
  onUpload,
  onRemove,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef("");
  const sourceFileRef = useRef<File | null>(null);
  const [open, setOpen] = useState(false);
  const [imageSource, setImageSource] = useState("");
  const [crop, setCrop] = useState<Point>(INITIAL_CROP);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropAreaPixels | null>(null);
  const [editorError, setEditorError] = useState("");
  const [uploading, setUploading] = useState(false);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = "";
  }, []);

  const closeEditor = useCallback(() => {
    setOpen(false);
    setImageSource("");
    setCroppedAreaPixels(null);
    setEditorError("");
    sourceFileRef.current = null;
    revokeObjectUrl();
  }, [revokeObjectUrl]);

  useEffect(() => () => revokeObjectUrl(), [revokeObjectUrl]);

  const openEditor = (source: string, objectUrl = "", sourceFile: File | null = null) => {
    revokeObjectUrl();
    objectUrlRef.current = objectUrl;
    sourceFileRef.current = sourceFile;
    setImageSource(source);
    setCrop(INITIAL_CROP);
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    setEditorError("");
    setOpen(true);
  };

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("choose a PNG, JPEG, or WebP image");
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_UPLOAD_BYTES) {
      toast.error("profile photos must be 2 MB or smaller");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    openEditor(objectUrl, objectUrl, file);
  };

  const saveCrop = async () => {
    if (!imageSource || !croppedAreaPixels) return;
    setUploading(true);
    setEditorError("");
    try {
      const file = await createCroppedProfileImage(imageSource, croppedAreaPixels, rotation);
      const saved = await onUpload(file, sourceFileRef.current || undefined);
      if (saved) closeEditor();
      else setEditorError("The photo could not be saved. Try again.");
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "The photo could not be edited.");
    } finally {
      setUploading(false);
    }
  };

  const handleCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const busy = saving || uploading;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 dark:border-slate-800 sm:flex-row sm:items-center" data-profile-image-editor>
        <div className="grid aspect-square w-24 min-h-0 min-w-0 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-2xl font-black text-slate-400 dark:bg-slate-800">
          {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : (name || "Y").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground dark:text-white">Profile photo</p>
          <p className="mt-1 max-w-lg text-xs leading-5 text-slate-500 dark:text-slate-400">
            Use the square crop shown here in your portfolio hero. You can choose the part of the image that visitors see, zoom it, or rotate it before saving.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
              <Upload className="h-3.5 w-3.5" /> {imageUrl ? "Change photo" : "Upload photo"}
              <Input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  chooseFile(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {imageUrl && (
              <Button
                type="button"
                onClick={() => openEditor(sourceImageUrl || imageUrl)}
                disabled={busy}
                className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit crop
              </Button>
            )}
            {imageUrl && (
              <Button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
              >
                Remove
              </Button>
            )}
          </div>
          <label className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-3.5 py-3 dark:border-slate-700">
            <span className="min-w-0">
              <span className="block text-xs font-bold text-foreground dark:text-white">Show on public portfolio</span>
              <span className="mt-0.5 block text-xs leading-4 text-slate-500 dark:text-slate-400">
                {imageUrl ? "Use this photo in the public hero when enabled." : "Upload a photo before choosing to display it."}
              </span>
            </span>
            <Switch
              aria-label="Show profile photo on public portfolio"
              checked={showOnPortfolio}
              onCheckedChange={onShowOnPortfolioChange}
              disabled={!imageUrl || busy}
            />
          </label>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) closeEditor(); }}>
        <DialogContent
          className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col overflow-y-auto data-[ending-style]:translate-y-0 data-[ending-style]:scale-100 data-[starting-style]:translate-y-0 data-[starting-style]:scale-100"
          aria-label="Edit profile photo"
        >
          <DialogTitle className="shrink-0 pr-8">Adjust your profile photo</DialogTitle>
          <DialogDescription className="mt-1 shrink-0 max-w-xl text-sm leading-6 text-muted-foreground">
            Drag the image to choose the section visitors will see. The final image is cropped to the same square shape used in your portfolio.
          </DialogDescription>

          <div
            className="relative mx-auto mt-4 aspect-square shrink-0 overflow-hidden rounded-2xl bg-slate-950"
            style={{ width: "min(36rem, calc(100vw - 2rem), 52dvh)" }}
            data-profile-image-cropper
          >
            {imageSource && (
              <Cropper
                image={imageSource}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={PROFILE_IMAGE_ASPECT_RATIO}
                minZoom={1}
                maxZoom={3}
                cropShape="rect"
                showGrid
                restrictPosition
                zoomWithScroll={false}
                keyboardStep={4}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={handleCropComplete}
                mediaProps={{ alt: "Profile photo being edited" }}
              />
            )}
          </div>

          <div className="mt-4 shrink-0 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="flex flex-col gap-2 text-xs font-bold text-foreground dark:text-white" htmlFor="profile-photo-zoom">
              Zoom
              <input
                id="profile-photo-zoom"
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="h-2 w-full cursor-pointer accent-blue-600"
                aria-valuetext={`${Math.round(zoom * 100)}%`}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setRotation((value) => value - 90)} disabled={busy} className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300" aria-label="Rotate photo left">
                <RotateCcw className="h-3.5 w-3.5" /> Rotate left
              </Button>
              <Button type="button" onClick={() => setRotation((value) => value + 90)} disabled={busy} className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300" aria-label="Rotate photo right">
                <RotateCw className="h-3.5 w-3.5" /> Rotate right
              </Button>
            </div>
          </div>

          {editorError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{editorError}</p>}

          <div className="mt-5 flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-popover pt-4 dark:border-slate-800">
            <Button type="button" onClick={closeEditor} disabled={busy} className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button type="button" onClick={() => void saveCrop()} disabled={busy || !croppedAreaPixels} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
              {uploading ? "Saving…" : "Save crop"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
