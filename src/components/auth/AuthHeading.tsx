import type { ReactNode } from "react";

export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-[1.65rem] font-black tracking-[-0.04em] text-foreground">{title}</h1>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
