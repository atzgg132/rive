"use client";

import { createContext, useContext, type ReactNode } from "react";

type FeatureAvailability = {
  agreements: boolean;
};

const FeatureAvailabilityContext = createContext<FeatureAvailability>({ agreements: false });

export function FeatureAvailabilityProvider({
  value,
  children,
}: {
  value: FeatureAvailability;
  children: ReactNode;
}) {
  return <FeatureAvailabilityContext.Provider value={value}>{children}</FeatureAvailabilityContext.Provider>;
}

export function useFeatureAvailability(): FeatureAvailability {
  return useContext(FeatureAvailabilityContext);
}
