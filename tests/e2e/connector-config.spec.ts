import { expect, test } from "@playwright/test";
import {
  googleCalendarAvailable,
  zohoBooksAvailable,
} from "../../src/utils/connectorConfig";

test.describe("connector configuration", () => {
  test.describe.configure({ mode: "serial" });

  const original = {
    googleEnabled: process.env.GOOGLE_CALENDAR_ENABLED,
    googleClientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    zohoEnabled: process.env.ZOHO_BOOKS_ENABLED,
    zohoClientId: process.env.ZOHO_BOOKS_CLIENT_ID,
    zohoClientSecret: process.env.ZOHO_BOOKS_CLIENT_SECRET,
  };

  test.afterAll(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore("GOOGLE_CALENDAR_ENABLED", original.googleEnabled);
    restore("GOOGLE_CALENDAR_CLIENT_ID", original.googleClientId);
    restore("GOOGLE_CALENDAR_CLIENT_SECRET", original.googleClientSecret);
    restore("ZOHO_BOOKS_ENABLED", original.zohoEnabled);
    restore("ZOHO_BOOKS_CLIENT_ID", original.zohoClientId);
    restore("ZOHO_BOOKS_CLIENT_SECRET", original.zohoClientSecret);
  });

  test("placeholder Google credentials do not enable the connector", () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "UNCONFIGURED";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "UNCONFIGURED";
    expect(googleCalendarAvailable()).toBe(false);

    process.env.GOOGLE_CALENDAR_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "google-client-secret";
    expect(googleCalendarAvailable()).toBe(false);

    process.env.GOOGLE_CALENDAR_ENABLED = "true";
    expect(googleCalendarAvailable()).toBe(true);
  });

  test("placeholder Zoho credentials do not enable the connector", () => {
    process.env.ZOHO_BOOKS_CLIENT_ID = "UNCONFIGURED";
    process.env.ZOHO_BOOKS_CLIENT_SECRET = "UNCONFIGURED";
    expect(zohoBooksAvailable()).toBe(false);

    process.env.ZOHO_BOOKS_CLIENT_ID = "zoho-client-id";
    process.env.ZOHO_BOOKS_CLIENT_SECRET = "zoho-client-secret";
    expect(zohoBooksAvailable()).toBe(false);

    process.env.ZOHO_BOOKS_ENABLED = "true";
    expect(zohoBooksAvailable()).toBe(true);
  });
});
