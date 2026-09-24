/**
 * Errors an Agreement route may show to the person who triggered them.
 *
 * Routes used to return `error.message` for anything thrown, and chose the
 * HTTP status by searching that message for words like "production". A Prisma
 * or driver error therefore reached the browser verbatim, and rewording a
 * message silently changed its status code. Throw this class for every
 * user-facing failure; anything else is logged and replaced with the route's
 * generic fallback.
 */
export class AgreementActionError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "AgreementActionError";
    this.status = status;
    this.code = code;
  }
}

export type AgreementErrorResult = {
  status: number;
  body: { success: false; message: string; code?: string };
  /** True when the error was unexpected and must be logged, never shown. */
  internal: boolean;
};

export function describeAgreementError(error: unknown, fallbackMessage: string): AgreementErrorResult {
  if (error instanceof AgreementActionError) {
    return {
      status: error.status,
      body: { success: false, message: error.message, ...(error.code ? { code: error.code } : {}) },
      internal: false,
    };
  }
  return { status: 500, body: { success: false, message: fallbackMessage }, internal: true };
}
