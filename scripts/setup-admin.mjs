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
