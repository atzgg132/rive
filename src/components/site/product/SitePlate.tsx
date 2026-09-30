import type { ReactNode } from "react";
import { AppWindowFrame } from "@/components/marketing/AppWindowFrame";
import styles from "./SitePlate.module.css";

type PlateGeometry = { w: number; h: number };

/** ResponsivePlate without the hydration jump: both geometries are in the
 * server HTML and a container query picks one, so the plate's height is
 * right on first paint (ResponsivePlate measures after mount, which on a
 * phone swapped a 1.3:1 frame for a 0.5:1 one and shifted the page). */
export function SitePlate({
  children,
  wide,
  narrow,
  breakpoint = 560,
}: {
  children: ReactNode;
  wide: PlateGeometry;
  narrow: PlateGeometry;
  breakpoint?: 480 | 560;
}) {
  return (
    <div className={`${styles.plate} ${breakpoint === 480 ? styles.at480 : styles.at560}`}>
      <div className={styles.wide}>
        <AppWindowFrame docWidth={wide.w} docHeight={wide.h}>{children}</AppWindowFrame>
      </div>
      <div className={styles.narrow}>
        <AppWindowFrame docWidth={narrow.w} docHeight={narrow.h}>{children}</AppWindowFrame>
      </div>
    </div>
  );
}
