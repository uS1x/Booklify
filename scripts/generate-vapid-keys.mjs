/**
 * Erzeugt ein VAPID-Schlüsselpaar für Web Push und schreibt es in .env.
 * Aufruf:  npm run push:keys
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
const envPath = new URL("../.env", import.meta.url);

let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

function upsert(name, value) {
  const line = `${name}="${value}"`;
  const re = new RegExp(`^${name}=.*$`, "m");
  env = re.test(env) ? env.replace(re, line) : `${env.trimEnd()}\n${line}\n`;
}

upsert("NEXT_PUBLIC_VAPID_PUBLIC_KEY", keys.publicKey);
upsert("VAPID_PRIVATE_KEY", keys.privateKey);
writeFileSync(envPath, env);

console.log("✔ VAPID-Schlüssel in .env geschrieben.");
console.log("  Public :", keys.publicKey);
