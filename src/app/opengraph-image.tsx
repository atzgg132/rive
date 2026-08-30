import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG_IMAGE } from "@/lib/siteMetadata";

export const alt = OG_IMAGE.alt;

export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };

export const contentType = "image/png";

export default async function Image() {
  /* Satori rejects woff2 ("Unsupported OpenType signature wOF2") and Outfit
     ships here in no other format, so brand type has to arrive as vector paths
     rather than a loaded font. */
  const wordmark = await readFile(join(process.cwd(), "public/brand/rive-wordmark-dark.svg"));

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#05070c",
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(37,99,235,0.28), transparent 55%), radial-gradient(circle at 78% 88%, rgba(34,211,238,0.16), transparent 55%)",
        }}
      >
        <img
          src={`data:image/svg+xml;base64,${wordmark.toString("base64")}`}
          width={460}
          height={181}
          alt=""
        />
        <div
          style={{
            marginTop: 52,
            maxWidth: 880,
            textAlign: "center",
            fontSize: 52,
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
            color: "#cbd5e1",
          }}
        >
          Run your service business in one connected workspace
        </div>
      </div>
    ),
    size,
  );
}
