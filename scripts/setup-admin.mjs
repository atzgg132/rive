import * as crypto from "crypto";
import * as readline from "readline";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function generateRandomPassword(length = 24) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let bits = 0;
  let accumulator = 0;
  let output = "";
  for (const byte of buffer) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(accumulator >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(accumulator << (5 - bits)) & 31];
  return output;
}

// `node scripts/setup-admin.mjs --totp` provisions the second factor: a base32
// seed for the authenticator app plus the exact places it has to land.
if (process.argv.includes("--totp")) {
  const secret = base32Encode(crypto.randomBytes(20));
  const uri = `otpauth://totp/Rive%20Admin?secret=${secret}&issuer=Rive&algorithm=SHA1&digits=6&period=30`;
  console.log("\n=== Rive Admin Authenticator (TOTP) Setup ===\n");
  console.log(`Secret (base32): ${secret}`);
  console.log(`Enrolment URI:   ${uri}\n`);
  console.log("Add the secret to an authenticator app (the URI works in a QR generator).");
  console.log("Keep a copy somewhere safe — losing it locks you out of the admin portal.\n");
  console.log("--- Add to SSM Parameter Store (SecureString) ---");
  console.log("Parameter name: /rive/{environment}/ADMIN_TOTP_SECRET");
  console.log(`Parameter value: ${secret}\n`);
  console.log("--- Or add to .env.local for local development ---");
  console.log(`ADMIN_TOTP_SECRET="${secret}"\n`);
  console.log("Once the variable is set, the admin login asks for the 6-digit code after the password.");
  console.log("Remove or empty it to sign in with username and password only.\n");
  rl.close();
  process.exit(0);
}

function hiddenQuestion(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    let value = "";
    const onData = (chunk) => {
      const key = chunk.toString();
      if (key === "\u0003") process.exit(130);
      if (key === "\r" || key === "\n") {
        stdin.removeListener("data", onData);
        if (stdin.isTTY) stdin.setRawMode(wasRaw || false);
        process.stdout.write("\n");
        resolve(value);
      } else if (key === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += key;
      }
    };
    stdin.on("data", onData);
  });
}

console.log("\n=== Rive Admin Password Setup ===\n");
console.log("This script generates a scrypt password hash for the admin portal.\n");
console.log("Options:");
console.log("  1. Enter your own password");
console.log("  2. Generate a random password\n");

rl.question("Choose option (1 or 2): ", (option) => {
  if (option.trim() === "2") {
    const password = generateRandomPassword();
    console.log("\n--- Generated Password ---");
    console.log(`Password: ${password}`);
    console.log("\nSave this password securely. It will not be shown again.\n");

    const hash = hashPassword(password);
    console.log("--- Add to SSM Parameter Store (SecureString) ---");
    console.log(`Parameter name: /rive/{environment}/ADMIN_PASSWORD_HASH`);
    console.log(`Parameter value (hash): ${hash}\n`);

    console.log("--- Or add to .env.local for local development ---");
    console.log(`ADMIN_PASSWORD_HASH="${hash}"\n`);

    rl.close();
    return;
  }

  rl.close();
  hiddenQuestion("\nEnter admin password: ").then((password) => {
    if (!password || password.trim().length < 12) {
      console.error("\nError: Password must be at least 12 characters.\n");
      process.exit(1);
    }

    const hash = hashPassword(password.trim());
    console.log("\n--- Password Hash Generated ---\n");
    console.log("--- Add to SSM Parameter Store (SecureString) ---");
    console.log(`Parameter name: /rive/{environment}/ADMIN_PASSWORD_HASH`);
    console.log(`Parameter value (hash): ${hash}\n`);

    console.log("--- Or add to .env.local for local development ---");
    console.log(`ADMIN_PASSWORD_HASH="${hash}"\n`);

  });
});
