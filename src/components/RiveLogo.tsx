interface RiveLogoProps {
  className?: string;
  color?: string;
  accentColor?: string;
  height?: number;
}

/** The source-owned Rive wordmark. Brand colors are explicit so link and
 * visited states can never recolor the logo. */
export function RiveLogo({
  className = "",
  color,
  accentColor,
  height = 28,
}: RiveLogoProps) {
  return (
    <span
      aria-label="rive."
      className={`inline-flex shrink-0 select-none items-baseline font-extrabold tracking-[-0.045em] ${className}`}
      style={{
        fontSize: `${height * 0.8}px`,
        lineHeight: 1,
        color: color ?? "rgb(var(--brand-wordmark))",
        fontFamily: "var(--font-sans)",
      }}
    >
      <span aria-hidden="true">rive</span>
      <span
        aria-hidden="true"
        style={{ color: accentColor ?? "rgb(var(--brand-accent))", marginLeft: "0.06em" }}
      >
        .
      </span>
    </span>
  );
}

export default RiveLogo;
