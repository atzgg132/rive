import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser, isGooglePlaceholderPassword } from "@/utils/userAuth";
import { googleCalendarAvailable, zohoBooksAvailable } from "@/utils/connectorConfig";

// Single aggregate read for the Settings page: every section's initial data
// in one round trip, scoped to the session user like every other workflow
// route. Each section still saves independently through its own PATCH route
// under src/app/api/settings/.
export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const [user, invoiceProfile, connectorConnections] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        profession: true,
        businessType: true,
        businessTypes: true,
        currency: true,
        displayCurrency: true,
        displayCurrencySource: true,
        timeZone: true,
        loginAlertsEnabled: true,
        googleSubject: true,
        passwordHash: true,
      },
    }),
    prisma.invoiceProfile.findUnique({ where: { userId: session.userId } }),
    prisma.connectorConnection.findMany({
      where: { userId: session.userId },
      select: { id: true, provider: true, accountLabel: true, status: true, lastSyncedAt: true, lastError: true },
    }),
  ]);
  if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

  const isGoogleOnlyAccount = Boolean(user.googleSubject) && isGooglePlaceholderPassword(user.passwordHash);

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      profession: user.profession,
      businessType: user.businessType,
      businessTypes: user.businessTypes,
      currency: user.currency,
      displayCurrency: user.displayCurrency,
      displayCurrencySource: user.displayCurrencySource,
      timeZone: user.timeZone,
      loginAlertsEnabled: user.loginAlertsEnabled,
      isGoogleOnlyAccount,
    },
    invoiceProfile,
    connectorConnections,
    connectorAvailability: {
      googleCalendar: googleCalendarAvailable(),
      zohoBooks: zohoBooksAvailable(),
    },
  });
}
