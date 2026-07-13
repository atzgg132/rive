/**
 * RiveLogo — pixel-perfect logo component using the website's brand font (Outfit)
 * with the characteristic blue dot at the end.
 */

interface RiveLogoProps {
  className?: string;
  color?: string; // Text color (default: deep navy)
  accentColor?: string; // Period/dot color (default: blue)
  height?: number;
}

export default function RiveLogo({
  className = "",
  color = "#0C1E36",
  accentColor = "#1D4ED8",
  height = 32,
}: RiveLogoProps) {
  return (
    <div 
      className={`inline-flex items-center select-none font-extrabold tracking-tight ${className}`} 
      style={{ 
        height, 
        fontSize: `${height * 0.8}px`,
        lineHeight: 1,
        color,
        fontFamily: "var(--font-sans)",
      }}
    >
      <span style={{ textTransform: "lowercase" }}>rive</span>
      <span style={{ color: accentColor, marginLeft: "0.05em" }}>.</span>
    </div>
  );
}
