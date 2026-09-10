import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { absoluteUrl, appStoreUrl, pagePath, site, withBase } from "../site.config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const catalog = loadJson("locales/catalog.json");
const terms = loadJson("content/terms.json");
const reviews = loadJson("content/reviews.json");
const translations = Object.fromEntries(
  site.locales
    .filter((locale) => locale.code !== site.defaultLocale)
    .map((locale) => [locale.code, loadJson(`locales/${locale.code}.json`)]),
);
const reviewTranslations = Object.fromEntries(
  site.locales.map((locale) => [
    locale.code,
    loadJson(`content/reviews/${locale.code}.json`),
  ]),
);

const catalogPlaceholders = {
  supportContact: "{email}",
  reviewsRating: "{rating}",
  reviewsTranslatedFrom: "{language}",
  reviewsVersion: "{version}",
};

validateCatalog(catalog, translations);
validateReviews(reviews, reviewTranslations);
const sortedReviews = [...reviews].sort((a, b) =>
  b.writtenAt.localeCompare(a.writtenAt),
);

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "images", "app-store"), { recursive: true });
cpSync(join(root, "images"), join(dist, "images"), { recursive: true });

for (const locale of site.locales) {
  copyFileSync(
    join(root, locale.appStoreBadge),
    join(dist, "images", "app-store", `${locale.code}.svg`),
  );
}

for (const locale of site.locales) {
  writeHtml(pagePath("home", locale), renderHome(locale));
  writeHtml(pagePath("support", locale), renderSupport(locale));
}

writeHtml(pagePath("terms", localeByDefault()), renderTerms());

writeFileSync(join(dist, "sitemap.xml"), renderSitemap());
writeFileSync(join(dist, "robots.txt"), renderRobots());
writeFileSync(join(dist, ".nojekyll"), "");

console.log(`Built site for ${absoluteUrl("/")}`);

function loadJson(relativePath) {
  const fullPath = join(root, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing ${relativePath}`);
  }
  return JSON.parse(readFileSync(fullPath, "utf8"));
}

function validateCatalog(source, localeTables) {
  const missing = [];
  const keys = Object.keys(source);

  if (keys.length === 0) {
    missing.push("catalog has no keys");
  }

  for (const key of keys) {
    const entry = source[key];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      missing.push(`"${key}" must be { comment, value }`);
      continue;
    }
    if (!nonemptyString(entry.comment)) {
      missing.push(`"${key}" has no translator comment`);
    }
    if (!nonemptyString(entry.value)) {
      missing.push(`"${key}" is missing English value`);
    }
  }

  checkPlaceholders("catalog", (key) => source[key]?.value, missing);

  for (const [code, table] of Object.entries(localeTables)) {
    if (table === null || typeof table !== "object" || Array.isArray(table)) {
      missing.push(`locales/${code}.json must be a flat object`);
      continue;
    }
    for (const key of keys) {
      if (!nonemptyString(table[key])) {
        missing.push(`locales/${code}.json is missing "${key}"`);
      }
    }
    for (const key of Object.keys(table)) {
      if (!Object.hasOwn(source, key)) {
        missing.push(`locales/${code}.json has extra key "${key}"`);
      }
    }
    checkPlaceholders(`locales/${code}.json`, (key) => table[key], missing);
  }

  if (missing.length > 0) {
    throw new Error(
      `String catalog is incomplete:\n${missing.map((item) => `  - ${item}`).join("\n")}`,
    );
  }
}

function checkPlaceholders(label, valueForKey, missing) {
  for (const [key, token] of Object.entries(catalogPlaceholders)) {
    const value = valueForKey(key);
    if (typeof value === "string" && !value.includes(token)) {
      missing.push(`${label} ${key} must contain ${token}`);
    }
  }
}

function t(key, localeCode) {
  const entry = catalog[key];
  if (!entry) {
    throw new Error(`Unknown string key "${key}"`);
  }
  if (localeCode === site.defaultLocale) {
    return entry.value;
  }
  const value = translations[localeCode]?.[key];
  if (!nonemptyString(value)) {
    throw new Error(`Missing ${localeCode} translation for "${key}"`);
  }
  return value;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fill(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

function stars(rating) {
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function nonemptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function validateReviews(items, localeTables) {
  const missing = [];

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Reviews list is incomplete:\n  - content/reviews.json must be a non-empty array");
  }

  const ids = new Set();

  items.forEach((review, index) => {
    const where = review?.id ? `"${review.id}"` : `item ${index}`;

    if (!nonemptyString(review?.id)) {
      missing.push(`${where} is missing id`);
    } else if (ids.has(review.id)) {
      missing.push(`duplicate id "${review.id}"`);
    } else {
      ids.add(review.id);
    }

    if (!Number.isInteger(review?.rating) || review.rating < 1 || review.rating > 5) {
      missing.push(`${where} rating must be an integer 1–5`);
    }
    if (!nonemptyString(review?.author)) {
      missing.push(`${where} is missing author`);
    }
    if (!isIsoDate(review?.writtenAt)) {
      missing.push(`${where} writtenAt must be YYYY-MM-DD`);
    }
    if (typeof review?.country !== "string" || !/^[A-Z]{2}$/.test(review.country)) {
      missing.push(`${where} country must be an ISO 3166-1 alpha-2 code`);
    }
    if (!nonemptyString(review?.appVersion)) {
      missing.push(`${where} is missing appVersion`);
    }
    if (typeof review?.sourceLanguage !== "string" || !/^[a-z]{2}$/.test(review.sourceLanguage)) {
      missing.push(`${where} sourceLanguage must be a two-letter language code`);
    }
    if (!nonemptyString(review?.title)) {
      missing.push(`${where} is missing source title`);
    }
    if (!nonemptyString(review?.body)) {
      missing.push(`${where} is missing source body`);
    }
  });

  for (const [code, table] of Object.entries(localeTables)) {
    if (table === null || typeof table !== "object" || Array.isArray(table)) {
      missing.push(`content/reviews/${code}.json must be a flat object`);
      continue;
    }

    for (const review of items) {
      if (!review?.id || review.sourceLanguage === code) {
        continue;
      }
      const entry = table[review.id];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        missing.push(`content/reviews/${code}.json is missing "${review.id}"`);
        continue;
      }
      if (!nonemptyString(entry.title)) {
        missing.push(`content/reviews/${code}.json "${review.id}" is missing title`);
      }
      if (!nonemptyString(entry.body)) {
        missing.push(`content/reviews/${code}.json "${review.id}" is missing body`);
      }
    }

    for (const id of Object.keys(table)) {
      const review = items.find((item) => item.id === id);
      if (!review) {
        missing.push(`content/reviews/${code}.json has extra id "${id}"`);
      } else if (review.sourceLanguage === code) {
        missing.push(
          `content/reviews/${code}.json should not translate "${id}" (already ${code})`,
        );
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Reviews list is incomplete:\n${missing.map((item) => `  - ${item}`).join("\n")}`,
    );
  }
}

function reviewCopy(review, localeCode) {
  if (review.sourceLanguage === localeCode) {
    return { title: review.title, body: review.body };
  }
  const entry = reviewTranslations[localeCode][review.id];
  return { title: entry.title, body: entry.body };
}

function formatReviewDate(iso, localeCode) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(localeCode, { dateStyle: "long" }).format(
    new Date(year, month - 1, day),
  );
}

function displayLanguage(code, localeCode) {
  return new Intl.DisplayNames([localeCode], { type: "language" }).of(code);
}

function displayRegion(code, localeCode) {
  return new Intl.DisplayNames([localeCode], { type: "region" }).of(code);
}

function renderReviewsSection(locale) {
  const articles = sortedReviews
    .map((review) => renderReview(review, locale))
    .join("\n");

  return `      <section>
        <h2>${escapeHtml(t("reviewsHeading", locale.code))}</h2>
${articles}
      </section>`;
}

function renderReview(review, locale) {
  const copy = reviewCopy(review, locale.code);
  const ratingText = fill(escapeHtml(t("reviewsRating", locale.code)), {
    rating: String(review.rating),
  });
  const versionText = fill(escapeHtml(t("reviewsVersion", locale.code)), {
    version: escapeHtml(review.appVersion),
  });
  const country = escapeHtml(displayRegion(review.country, locale.code));
  const dateLabel = escapeHtml(formatReviewDate(review.writtenAt, locale.code));
  const bodyHtml = copy.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `          <p>${escapeHtml(line)}</p>`)
    .join("\n");

  const translatedFrom =
    review.sourceLanguage === locale.code
      ? ""
      : `          <p>${fill(escapeHtml(t("reviewsTranslatedFrom", locale.code)), {
          language: escapeHtml(
            displayLanguage(review.sourceLanguage, locale.code),
          ),
        })}</p>\n`;

  return `        <article>
          <p><span aria-hidden="true">${stars(review.rating)}</span> ${ratingText}</p>
          <h3>${escapeHtml(copy.title)}</h3>
          <p><time datetime="${escapeHtml(review.writtenAt)}">${dateLabel}</time> — ${escapeHtml(review.author)}</p>
          <p>${versionText} · ${country}</p>
${translatedFrom}          <blockquote>
${bodyHtml}
          </blockquote>
        </article>`;
}

function localeByDefault() {
  return site.locales.find((item) => item.code === site.defaultLocale);
}

function outputDir(urlPath) {
  const relative = urlPath.replace(/^\/|\/$/g, "");
  return relative === "" ? dist : join(dist, relative);
}

function writeHtml(urlPath, html) {
  const dir = outputDir(urlPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
}

function hreflangTags(page) {
  const defaultPath = pagePath(page, localeByDefault());
  return [
    ...site.locales.map(
      (item) =>
        `    <link rel="alternate" hreflang="${item.code}" href="${absoluteUrl(pagePath(page, item))}">`,
    ),
    `    <link rel="alternate" hreflang="x-default" href="${absoluteUrl(defaultPath)}">`,
  ].join("\n");
}

function ogLocaleAlternates(locale) {
  return site.locales
    .filter((item) => item.code !== locale.code)
    .map(
      (item) =>
        `    <meta property="og:locale:alternate" content="${item.ogLocale}">`,
    )
    .join("\n");
}

function languageNav(locale, page) {
  const links = site.locales
    .map((item) => {
      const current = item.code === locale.code ? ' aria-current="page"' : "";
      return `          <li><a href="${withBase(pagePath(page, item))}" hreflang="${item.code}" lang="${item.code}"${current}>${escapeHtml(item.nativeName)}</a></li>`;
    })
    .join("\n");

  return `    <!--
      <details> collapses the list; the <a href> links stay in the HTML
      so crawlers can still follow every translation. Do not replace
      this with a <select> — option values are not links.
      The picker stays on this page type (home stays on home, support
      stays on support).
    -->
    <nav aria-label="${escapeHtml(t("languageNavLabel", locale.code))}">
      <details>
        <summary>${escapeHtml(locale.nativeName)}</summary>
        <ul>
${links}
        </ul>
      </details>
    </nav>`;
}

function footerNav(locale, currentPage) {
  const termsHref = withBase(pagePath("terms", locale));
  const supportHref = withBase(pagePath("support", locale));
  const termsCurrent = currentPage === "terms" ? ' aria-current="page"' : "";
  const supportCurrent = currentPage === "support" ? ' aria-current="page"' : "";

  return `    <footer>
      <nav aria-label="${escapeHtml(t("footerNavLabel", locale.code))}">
        <ul>
          <li><a href="${termsHref}"${termsCurrent}>${escapeHtml(t("footerTerms", locale.code))}</a></li>
          <li><a href="${supportHref}"${supportCurrent}>${escapeHtml(t("footerSupport", locale.code))}</a></li>
        </ul>
      </nav>
    </footer>`;
}

function appStoreBlock(locale) {
  const href = appStoreUrl(locale);
  const badgePath = `/images/app-store/${locale.code}.svg`;
  const alt = t("appStoreBadgeAlt", locale.code);

  return `    <!--
      Official Apple badge as a real <a href> (not a button or JS).
      The storefront in the URL matches the page language so Google
      and the App Store land on the right country listing.
      The image is a separate localized asset because it contains words.
    -->
    <aside>
      <h2>${escapeHtml(t("appStoreHeading", locale.code))}</h2>
      <p>
        <a href="${escapeHtml(href)}" hreflang="${locale.code}" rel="external">
          <img src="${withBase(badgePath)}" alt="${escapeHtml(alt)}" width="120" height="40" lang="${locale.code}">
        </a>
      </p>
    </aside>`;
}

function appJsonLd(locale) {
  const href = appStoreUrl(locale);
  return {
    "@type": "MobileApplication",
    name: site.appStore.name,
    operatingSystem: "iOS, iPadOS",
    applicationCategory: "EducationalApplication",
    downloadUrl: href,
    installUrl: href,
    inLanguage: locale.code,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

function linkEmail(template, email) {
  const link = `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`;
  return escapeHtml(template).replaceAll("{email}", link);
}

function ogShare(locale) {
  return {
    imageUrl: absoluteUrl("/images/app-logo/og-share.png"),
    imageAlt: t("ogImageAlt", locale.code),
    imageWidth: 1200,
    imageHeight: 630,
  };
}

function renderDocument({
  locale,
  title,
  description,
  pageUrl,
  hreflangHtml,
  jsonLd,
  imageUrl,
  imageAlt,
  imageWidth,
  imageHeight,
  ogTitle = title,
  ogDescription = description,
  languageNavHtml,
  mainHtml,
  footerHtml,
  localized = true,
}) {
  const lastMod = new Date().toISOString().slice(0, 10);
  jsonLd.dateModified = lastMod;

  return `<!DOCTYPE html>
<html lang="${locale.code}" dir="${locale.dir}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="${withBase("/images/app-logo/favicon-32.png")}" type="image/png" sizes="32x32">
    <link rel="apple-touch-icon" href="${withBase("/images/app-logo/apple-touch-icon.png")}" sizes="180x180">

    <!--
      Not visual design. Google indexes the phone-sized page.
      Without this, a 1080px image overflows small screens and fails
      the mobile-friendly check.
    -->
    <style>
      html { color-scheme: light; }
      img { max-width: 100%; height: auto; }
    </style>

    <!-- Visible title + search snippet. Unique per language (and per page). -->
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">

    <!-- Safari on iPhone/iPad draws the native App Store banner from this id. Same on every language. -->
    <meta name="apple-itunes-app" content="app-id=${site.appStore.id}">

    <!-- Each URL canonicalizes to itself, never to English. -->
    <link rel="canonical" href="${pageUrl}">
${hreflangHtml}

    <!--
      Open Graph: iMessage, Telegram, Slack, WhatsApp, Facebook.
      Title and description here are the chat card, not the Google snippet.
      og:locale uses underscores.
    -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:title" content="${escapeHtml(ogTitle)}">
    <meta property="og:description" content="${escapeHtml(ogDescription)}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="${imageWidth}">
    <meta property="og:image:height" content="${imageHeight}">
    <meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
    <meta property="og:locale" content="${locale.ogLocale}">
${localized ? `${ogLocaleAlternates(locale)}\n` : ""}

    <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 6).replaceAll("<", "\\u003c")}
    </script>
  </head>
  <body>
${languageNavHtml}

${mainHtml}

${appStoreBlock(locale)}

${footerHtml}
  </body>
</html>
`;
}

function websiteJsonLd() {
  return {
    "@type": "WebSite",
    url: absoluteUrl("/"),
    inLanguage: site.locales.map((item) => item.code),
  };
}

function translationList(page, locale) {
  return site.locales
    .filter((item) => item.code !== locale.code)
    .map((item) => ({
      "@type": "WebPage",
      url: absoluteUrl(pagePath(page, item)),
      inLanguage: item.code,
    }));
}

function renderHome(locale) {
  const pageUrl = absoluteUrl(pagePath("home", locale));
  const title = t("metaTitle", locale.code);
  const description = t("metaDescription", locale.code);
  const imagePath = `/images/hello-world-${locale.code}.png`;
  const imageHref = withBase(imagePath);
  const heroImageUrl = absoluteUrl(imagePath);
  const imageAlt = t("imageAlt", locale.code);
  const share = ogShare(locale);

  const mainHtml = `    <main>
      <h1>${escapeHtml(t("heading", locale.code))}</h1>
      <p>${escapeHtml(t("body", locale.code))}</p>
      <!--
        The heading above is HTML text (indexable).
        This image is a separate localized asset because it contains words.
      -->
      <p>
        <img src="${imageHref}" alt="${escapeHtml(imageAlt)}" width="1080" height="1080">
      </p>
${renderReviewsSection(locale)}
    </main>`;

  return renderDocument({
    locale,
    title,
    description,
    pageUrl,
    hreflangHtml: `    <!--
      hreflang is how Google maps this page to its translations.
      Home hreflang points at other homes, not at Support or Terms.
    -->
${hreflangTags("home")}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      url: pageUrl,
      name: title,
      description,
      inLanguage: locale.code,
      isPartOf: websiteJsonLd(),
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: heroImageUrl,
        width: 1080,
        height: 1080,
        caption: imageAlt,
      },
      workTranslation: translationList("home", locale),
      mentions: appJsonLd(locale),
    },
    imageUrl: share.imageUrl,
    imageAlt: share.imageAlt,
    imageWidth: share.imageWidth,
    imageHeight: share.imageHeight,
    ogTitle: t("ogTitle", locale.code),
    ogDescription: t("ogDescription", locale.code),
    languageNavHtml: languageNav(locale, "home"),
    mainHtml,
    footerHtml: footerNav(locale, "home"),
  });
}

function renderSupport(locale) {
  const pageUrl = absoluteUrl(pagePath("support", locale));
  const title = t("supportMetaTitle", locale.code);
  const description = t("supportMetaDescription", locale.code);
  const share = ogShare(locale);
  const contact = linkEmail(
    t("supportContact", locale.code),
    site.supportEmail,
  );

  const mainHtml = `    <main>
      <h1>${escapeHtml(t("supportHeading", locale.code))}</h1>
      <p>${escapeHtml(t("supportIntro", locale.code))}</p>
      <p>${escapeHtml(t("supportLead", locale.code))}</p>
      <h2>${escapeHtml(t("supportStep1Title", locale.code))}</h2>
      <p>${escapeHtml(t("supportStep1Body", locale.code))}</p>
      <h2>${escapeHtml(t("supportStep2Title", locale.code))}</h2>
      <p>${escapeHtml(t("supportStep2Body", locale.code))}</p>
      <h2>${escapeHtml(t("supportStep3Title", locale.code))}</h2>
      <p>${escapeHtml(t("supportStep3Body", locale.code))}</p>
      <p>${contact}</p>
      <p>${escapeHtml(t("supportEvidence", locale.code))}</p>
    </main>`;

  return renderDocument({
    locale,
    title,
    description,
    pageUrl,
    hreflangHtml: `    <!-- Support hreflang points at the other Support URLs, not at Home. -->
${hreflangTags("support")}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      url: pageUrl,
      name: title,
      description,
      inLanguage: locale.code,
      isPartOf: websiteJsonLd(),
      workTranslation: translationList("support", locale),
      mentions: appJsonLd(locale),
    },
    imageUrl: share.imageUrl,
    imageAlt: share.imageAlt,
    imageWidth: share.imageWidth,
    imageHeight: share.imageHeight,
    languageNavHtml: languageNav(locale, "support"),
    mainHtml,
    footerHtml: footerNav(locale, "support"),
  });
}

function renderTerms() {
  const locale = localeByDefault();
  const pageUrl = absoluteUrl(pagePath("terms", locale));
  const share = ogShare(locale);
  const items = terms.items
    .map((item) => `        <li>${escapeHtml(item)}</li>`)
    .join("\n");

  const mainHtml = `    <main>
      <h1>${escapeHtml(terms.heading)}</h1>
      <p>${escapeHtml(terms.welcome)}</p>
      <p>${escapeHtml(terms.intro)}</p>
      <ol>
${items}
      </ol>
      <p>${escapeHtml(terms.closing)}</p>
    </main>`;

  return renderDocument({
    locale,
    title: terms.metaTitle,
    description: terms.metaDescription,
    pageUrl,
    hreflangHtml: `    <!--
      Terms is English-only. Do not invent da/ar hreflang URLs.
      There is no translated equivalent, so there is no alternate set.
    -->`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      url: pageUrl,
      name: terms.metaTitle,
      description: terms.metaDescription,
      inLanguage: "en",
      isPartOf: websiteJsonLd(),
      mentions: appJsonLd(locale),
    },
    imageUrl: share.imageUrl,
    imageAlt: share.imageAlt,
    imageWidth: share.imageWidth,
    imageHeight: share.imageHeight,
    languageNavHtml: `    <!-- No language picker: this document is not localized. -->`,
    mainHtml,
    footerHtml: footerNav(locale, "terms"),
    localized: false,
  });
}

function sitemapCluster(page) {
  const xhtmlLinks = site.locales
    .map(
      (item) =>
        `    <xhtml:link rel="alternate" hreflang="${item.code}" href="${absoluteUrl(pagePath(page, item))}" />`,
    )
    .concat(
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${absoluteUrl(pagePath(page, localeByDefault()))}" />`,
    )
    .join("\n");

  return site.locales
    .map(
      (item) => `  <url>
    <loc>${absoluteUrl(pagePath(page, item))}</loc>
${xhtmlLinks}
  </url>`,
    )
    .join("\n");
}

function renderSitemap() {
  const termsUrl = `  <url>
    <loc>${absoluteUrl(pagePath("terms", localeByDefault()))}</loc>
  </url>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapCluster("home")}
${sitemapCluster("support")}
${termsUrl}
</urlset>
`;
}

function renderRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${absoluteUrl("/sitemap.xml")}
`;
}
