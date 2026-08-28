export const GOOGLE_LOGIN_SCOPES = ["openid", "email", "profile"] as const;

export const GOOGLE_CALENDAR_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
] as const;
