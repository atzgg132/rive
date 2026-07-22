/**
 * API utility to submit waitlist signups to the Express backend.
 * Returns structured result with `alreadyJoined` flag for 409 responses.
 */
export type WaitlistResult = {
  success: boolean;
  alreadyJoined: boolean;
  message: string;
};

export async function submitToWaitlist(
  email: string,
  type: "waitlist" | "login" | "demo" | "remit"
): Promise<WaitlistResult> {
  try {
    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, type }),
    });

    const data = await response.json();

    if (response.status === 409) {
      return {
        success: false,
        alreadyJoined: true,
        message: data.message || "email address is already registered.",
      };
    }

    return {
      success: response.ok,
      alreadyJoined: false,
      message: data.message || "successfully submitted.",
    };
  } catch {
    // Backend unreachable — treat as fresh success so the UI stays functional
    return {
      success: false,
      alreadyJoined: false,
      message: "we couldn't reach the server. please try again.",
    };
  }
}
