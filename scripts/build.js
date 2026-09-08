import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { absoluteUrl, site } from "../site.config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const catalog = JSON.parse(
  readFileSync(join(root, "locales", "strings.json"), "utf8"),
);

const requiredKeys = [
  "metaTitle",
  "metaDescription",
  "heading",
  "body",
  "imageAlt",
  "languageNavLabel",
];

validateCatalog(catalog, site.locales.map((locale) => locale.code), requiredKeys);

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "images"), { recursive: true });
cpSync(join(root, "images"), join(dist, "images"), { recursive: true });

for (const locale of site.locales) {
  const html = renderPage(locale);
  const dir = pageOutputDir(locale);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
}

writeFileSync(join(dist, "sitemap.xml"), renderSitemap());
writeFileSync(join(dist, "robots.txt"), renderRobots());

console.log(`Built ${site.locales.length} localized pages into dist/`);

function validateCatalog(strings, localeCodes, keys) {
  const missing = [];

  for (const key of keys) {
    const entry = strings[key];
    if (!entry) {
      missing.push(`missing key "${key}"`);
      continue;
    }
    if (!entry.comment) {
      missing.push(`"${key}" has no translator comment`);
    }
    for (const code of localeCodes) {
      if (typeof entry[code] !== "string" || entry[code].trim() === "") {
        missing.push(`"${key}" is missing ${code}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `String catalog is incomplete:\n${missing.map((item) => `  - ${item}`).join("\n")}`,
    );
  }
}

function t(key, localeCode) {
  return catalog[key][localeCode];
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPage(locale) {
  const pageUrl = absoluteUrl(locale.path);
  const title = t("metaTitle", locale.code);
  const description = t("metaDescription", locale.code);
  const heading = t("heading", locale.code);
  const body = t("body", locale.code);
  const imageAlt = t("imageAlt", locale.code);
  const languageNavLabel = t("languageNavLabel", locale.code);
  const imagePath = `/images/hello-world-${locale.code}.png`;
  const imageUrl = absoluteUrl(imagePath);
  const imageWidth = 1080;
  const imageHeight = 1080;
  const lastMod = new Date().toISOString().slice(0, 10);

  const hreflangLinks = [
    ...site.locales.map(
      (item) =>
        `    <link rel="alternate" hreflang="${item.code}" href="${absoluteUrl(item.path)}">`,
    ),
    `    <link rel="alternate" hreflang="x-default" href="${absoluteUrl(localeByDefault().path)}">`,
  ].join("\n");

  const ogLocaleAlternates = site.locales
    .filter((item) => item.code !== locale.code)
    .map(
      (item) =>
        `    <meta property="og:locale:alternate" content="${item.ogLocale}">`,
    )
    .join("\n");

  const languageLinks = site.locales
    .map((item) => {
      const current = item.code === locale.code ? ' aria-current="page"' : "";
      return `        <li><a href="${item.path}" hreflang="${item.code}" lang="${item.code}"${current}>${escapeHtml(item.nativeName)}</a></li>`;
    })
    .join("\n");

  const translations = site.locales
    .filter((item) => item.code !== locale.code)
    .map((item) => ({
      "@type": "WebPage",
      url: absoluteUrl(item.path),
      inLanguage: item.code,
    }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: pageUrl,
    name: title,
    description,
    inLanguage: locale.code,
    dateModified: lastMod,
    isPartOf: {
      "@type": "WebSite",
      url: `${site.url}/`,
      inLanguage: site.locales.map((item) => item.code),
    },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: imageUrl,
      width: imageWidth,
      height: imageHeight,
      caption: imageAlt,
    },
    workTranslation: translations,
  };

  return `<!DOCTYPE html>
<html lang="${locale.code}" dir="${locale.dir}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <!--
      Not visual design. Google indexes the phone-sized page.
      Without this, a 1080px image overflows small screens and fails
      the mobile-friendly check.
    -->
    <style>
      html { color-scheme: light; }
      img { max-width: 100%; height: auto; }
    </style>

    <!-- Visible title + search snippet. Unique per language. -->
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">

    <!-- Each language URL canonicalizes to itself, never to English. -->
    <link rel="canonical" href="${pageUrl}">

    <!--
      hreflang is how Google maps this page to its translations.
      Every language version lists every other version, including itself.
      x-default is the fallback when the user's language is not offered.
    -->
${hreflangLinks}

    <!-- Open Graph: used by chat apps and some search features. og:locale uses underscores. -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="${imageWidth}">
    <meta property="og:image:height" content="${imageHeight}">
    <meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
    <meta property="og:locale" content="${locale.ogLocale}">
${ogLocaleAlternates}

    <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 6).replaceAll("<", "\\u003c")}
    </script>
  </head>
  <body>
    <!--
      <details> collapses the list; the <a href> links stay in the HTML
      so crawlers can still follow every translation. Do not replace
      this with a <select> — option values are not links.
      The summary shows the current language in its native name.
    -->
    <nav aria-label="${escapeHtml(languageNavLabel)}">
      <details>
        <summary>${escapeHtml(locale.nativeName)}</summary>
        <ul>
${languageLinks}
        </ul>
      </details>
    </nav>

    <main>
      <h1>${escapeHtml(heading)}</h1>
      <p>${escapeHtml(body)}</p>
      <!--
        The heading above is HTML text (indexable).
        This image is a separate localized asset because it contains words.
        width/height prevent layout shift; alt is in the page language.
      -->
      <p>
        <img src="${imagePath}" alt="${escapeHtml(imageAlt)}" width="${imageWidth}" height="${imageHeight}">
      </p>
    </main>
  </body>
</html>
`;
}

function pageOutputDir(locale) {
  const relative = locale.path.replace(/^\/|\/$/g, "");
  return relative === "" ? dist : join(dist, relative);
}

function localeByDefault() {
  return site.locales.find((item) => item.code === site.defaultLocale);
}

function renderSitemap() {
  const xhtmlLinks = site.locales
    .map(
      (item) =>
        `    <xhtml:link rel="alternate" hreflang="${item.code}" href="${absoluteUrl(item.path)}" />`,
    )
    .concat(
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${absoluteUrl(localeByDefault().path)}" />`,
    )
    .join("\n");

  const urls = site.locales
    .map((item) => {
      return `  <url>
    <loc>${absoluteUrl(item.path)}</loc>
${xhtmlLinks}
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

function renderRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${absoluteUrl("/sitemap.xml")}
`;
}
