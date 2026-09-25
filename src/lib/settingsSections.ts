/** Settings page sections, in page order. The ids are the page's anchors (`/settings#invoicing`). */
export const SETTINGS_SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "invoicing", label: "Business & invoicing" },
  { id: "workspace", label: "Workspace defaults" },
  { id: "preferences", label: "Preferences" },
  { id: "notifications", label: "Notifications" },
  { id: "integrations", label: "Integrations" },
  { id: "security", label: "Security" },
] as const;
