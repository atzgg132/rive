import { z } from "zod";

export enum SignupType {
  waitlist = "waitlist",
  login = "login",
  demo = "demo"
}

export const waitlistSchema = z.object({
  email: z
    .string()
    .min(1, { message: "email address is required" })
    .email({ message: "invalid email format" })
    .transform((val) => val.toLowerCase().trim()),
  type: z
    .nativeEnum(SignupType)
    .default(SignupType.waitlist),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
