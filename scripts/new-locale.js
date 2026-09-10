import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { site } from "../site.config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const code = process.argv[2]?.trim();

if (!code || !/^[a-z]{2}$/.test(code)) {
  console.error("Usage: npm run locale -- <code>");
  console.error("Example: npm run locale -- te");
  process.exit(1);
}

if (code === site.defaultLocale) {
  console.error(
    `"${code}" is the source catalog language. Do not add locales/${code}.json.`,
  );
  process.exit(1);
}

const localePath = join(root, "locales", `${code}.json`);
const reviewsPath = join(root, "content", "reviews", `${code}.json`);

if (existsSync(localePath) || existsSync(reviewsPath)) {
  console.error(`Locale "${code}" already has files. Refusing to overwrite.`);
  process.exit(1);
}

const catalog = JSON.parse(
  readFileSync(join(root, "locales", "catalog.json"), "utf8"),
);
const reviews = JSON.parse(
  readFileSync(join(root, "content", "reviews.json"), "utf8"),
);
const englishReviews = JSON.parse(
  readFileSync(join(root, "content", "reviews", "en.json"), "utf8"),
);

const strings = Object.fromEntries(
  Object.entries(catalog).map(([key, entry]) => [key, entry.value]),
);

const reviewTable = {};
for (const review of reviews) {
  if (review.sourceLanguage === code) {
    continue;
  }
  if (review.sourceLanguage === site.defaultLocale) {
    reviewTable[review.id] = { title: review.title, body: review.body };
    continue;
  }
  const english = englishReviews[review.id];
  if (!english) {
    throw new Error(`content/reviews/en.json is missing "${review.id}"`);
  }
  reviewTable[review.id] = { title: english.title, body: english.body };
}

writeFileSync(localePath, `${JSON.stringify(strings, null, 2)}\n`);
writeFileSync(reviewsPath, `${JSON.stringify(reviewTable, null, 2)}\n`);

console.log(`Created locales/${code}.json`);
console.log(`Created content/reviews/${code}.json`);
console.log("");
console.log("Translate those two files. Give the agent:");
console.log("  - locales/catalog.json");
console.log("  - content/reviews.json");
console.log("  - content/reviews/en.json");
console.log("Do not attach da.json, ar.json, or other finished locales.");
console.log("");
console.log("Then:");
console.log("  1. Add a locale object to site.config.js");
console.log(`  2. Add images/hello-world-${code}.png`);
console.log("  3. Add a localized App Store badge and point appStoreBadge at it");
