/**
 * Legt beim ersten Setup eine .env aus .env.example an:
 * zufälliges AUTH_SECRET und ein frisches VAPID-Schlüsselpaar für Web Push.
 * Eine vorhandene .env wird nie überschrieben.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import webpush from "web-push";

const envUrl = new URL("../.env", import.meta.url);
const exampleUrl = new URL("../.env.example", import.meta.url);

if (existsSync(envUrl)) {
  console.log("✔ .env vorhanden – bleibt unverändert.");
  process.exit(0);
}

copyFileSync(exampleUrl, envUrl);
let env = readFileSync(envUrl, "utf8");

const set = (name, value) => {
  env = env.replace(new RegExp(`^${name}=.*$`, "m"), `${name}="${value}"`);
};

set("AUTH_SECRET", randomBytes(32).toString("hex"));
const keys = webpush.generateVAPIDKeys();
set("NEXT_PUBLIC_VAPID_PUBLIC_KEY", keys.publicKey);
set("VAPID_PRIVATE_KEY", keys.privateKey);

writeFileSync(envUrl, env);
console.log("✔ .env angelegt (AUTH_SECRET und VAPID-Schlüssel erzeugt).");
