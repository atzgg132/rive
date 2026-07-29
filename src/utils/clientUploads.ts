"use client";

type PresignResponse = {
  uploadUrl: string;
  assetUrl: string;
  headers: Record<string, string>;
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

export async function uploadImage(file: File): Promise<string> {
  const response = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      purpose: "portfolio",
    }),
  });

  if (response.status === 503) {
    return readAsDataUrl(file);
  }

  const data = (await response.json()) as Partial<PresignResponse> & { message?: string };
  if (!response.ok || !data.uploadUrl || !data.assetUrl) {
    throw new Error(data.message || "The image could not be prepared for upload.");
  }

  const upload = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: data.headers,
    body: file,
  });
  if (!upload.ok) throw new Error("The image upload did not complete.");
  return data.assetUrl;
}
