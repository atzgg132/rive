"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";
import { ProfileSection, type ProfileSectionData } from "@/components/settings/ProfileSection";
import { WorkspaceDefaultsSection } from "@/components/settings/WorkspaceDefaultsSection";
import { BusinessInvoicingSection } from "@/components/settings/BusinessInvoicingSection";
import { PreferencesSection } from "@/components/settings/PreferencesSection";
import { NotificationsSection } from "@/components/settings/NotificationsSection";
import { IntegrationsSection } from "@/components/settings/IntegrationsSection";
import { SecuritySection } from "@/components/settings/SecuritySection";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "invoicing", label: "Business & invoicing" },
  { id: "workspace", label: "Workspace defaults" },
  { id: "preferences", label: "Preferences" },
  { id: "notifications", label: "Notifications" },
  { id: "integrations", label: "Integrations" },
  { id: "security", label: "Security" },
] as const;

type SettingsPayload = {
  user: ProfileSectionData & {
    currency: string;
    timeZone: string;
    loginAlertsEnabled: boolean;
    isGoogleOnlyAccount: boolean;
  };
  invoiceProfile: {
    businessName: string | null;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    taxId: string | null;
    logoUrl: string | null;
    invoicePrefix: string;
    paymentInstructions: string | null;
    defaultTerms: string | null;
    defaultPaymentTermsDays: number | null;
  } | null;
  connectorAvailability: { googleCalendar: boolean; zohoBooks: boolean };
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        if (!payload?.success) throw new Error(payload?.message || "Settings could not be loaded.");
        setData(payload);
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Settings could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">Loading settings…</div>;
  if (error || !data) return <div className="grid min-h-[60vh] place-items-center text-sm text-destructive">{error || "Settings could not be loaded."}</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Settings" description="Your profile, business details, workspace defaults, and account security." />

      {/* Mobile: horizontally scrollable section links. */}
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="shrink-0 whitespace-nowrap rounded-none border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground">
            {section.label}
          </a>
        ))}
      </nav>

      <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
        {/* Desktop: sticky left nav. */}
        <nav className="hidden md:sticky md:top-24 md:block md:h-fit md:space-y-1">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="block rounded-none px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
              {section.label}
            </a>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          <ProfileSection data={data.user} />
          <BusinessInvoicingSection data={data.invoiceProfile || {
            businessName: null, contactName: null, email: null, phone: null, address: null, taxId: null,
            logoUrl: null, invoicePrefix: "INV", paymentInstructions: null, defaultTerms: null, defaultPaymentTermsDays: null,
          }} />
          <WorkspaceDefaultsSection data={{ currency: data.user.currency, timeZone: data.user.timeZone }} />
          <PreferencesSection />
          <NotificationsSection loginAlertsEnabled={data.user.loginAlertsEnabled} />
          <IntegrationsSection zohoBooksAvailable={data.connectorAvailability.zohoBooks} />
          <SecuritySection isGoogleOnlyAccount={data.user.isGoogleOnlyAccount} />
        </div>
      </div>
    </div>
  );
}
