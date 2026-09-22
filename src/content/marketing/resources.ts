export const CONTACT_SUBJECTS = [
  "Product question",
  "Support",
  "Feedback",
  "Partnership",
  "Press",
  "Other",
] as const;

export const contactContent = {
  eyebrow: "Contact",
  title: "Talk to the people building Rive.",
  intro: "Have a product question, need help, or want to share feedback? Send us a message.",
  asideTitle: "Write directly",
  asideBody: "Please don’t include passwords, payment details, or confidential client information.",
  email: "hello@rive.work",
  form: {
    nameLabel: "Name",
    namePlaceholder: "Your name",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    subjectLabel: "Topic",
    subjects: CONTACT_SUBJECTS,
    messageLabel: "Message",
    messagePlaceholder: "Tell us what you need help with.",
    submitLabel: "Send message",
    submittingLabel: "Sending…",
    successTitle: "Message sent.",
    successBody: "Thanks for getting in touch. We’ll reply to the email address you provided.",
    fallbackError: "We couldn’t send your message. Please try again or email hello@rive.work.",
  },
} as const;
