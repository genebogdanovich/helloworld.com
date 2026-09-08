/**
 * Site-wide i18n and URL policy.
 *
 * This is the web equivalent of an Xcode project’s known locales.
 * Copy lives in locales/strings.json; routing and direction live here.
 *
 * URL rule (this is the SEO-critical choice):
 *   One language = one URL. Never swap strings with JavaScript on a
 *   single URL. Google indexes URLs, not runtime state.
 *
 *   English (default)  {origin}{basePath}/
 *   Danish             {origin}{basePath}/da/
 *   Arabic             {origin}{basePath}/ar/
 *
 * Localized inner pages follow the same prefix:
 *   Support            /support/   /da/support/   /ar/support/
 *
 * Untranslated pages get one URL, not a copy per language:
 *   Terms              /terms/
 *
 * English stays at `/` (after the hosting base path) because this is
 * a .com-style site with English as the default. Do not also publish
 * `/en/` — that would be duplicate content.
 *
 * Hosting:
 *   Local `npm run preview` leaves SITE_BASE_PATH empty so hrefs are
 *   `/da/`, `/support/`, and so on.
 *
 *   GitHub Pages project sites live at
 *   https://<user>.github.io/<repo>/
 *   so every in-page href and canonical URL must include `/<repo>`.
 *   The workflow sets SITE_ORIGIN and SITE_BASE_PATH from
 *   actions/configure-pages. Files in dist/ do NOT nest `<repo>/`;
 *   GitHub already mounts the artifact at that path.
 */
function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function normalizeBasePath(value) {
  const trimmed = value.replace(/\/$/, "");
  if (trimmed === "" || trimmed === "/") {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const site = {
  origin: env("SITE_ORIGIN", "http://127.0.0.1:4173"),
  basePath: normalizeBasePath(env("SITE_BASE_PATH", "")),
  defaultLocale: "en",
  supportEmail: "hello@example.com",
  appStore: {
    id: "6462816053",
    name: "Flash Cards: Create With AI",
  },
  locales: [
    {
      code: "en",
      dir: "ltr",
      ogLocale: "en_US",
      path: "/",
      nativeName: "English",
      appStoreStorefront: "us",
      appStoreBadge:
        "images/Download-on-the-App-Store/US/Download_on_App_Store/Black_lockup/SVG/Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917.svg",
    },
    {
      code: "da",
      dir: "ltr",
      ogLocale: "da_DK",
      path: "/da/",
      nativeName: "Dansk",
      appStoreStorefront: "dk",
      appStoreBadge:
        "images/Download-on-the-App-Store/DK/Download_on_App_Store/Black_lockup/SVG/Download_on_the_App_Store_Badge_DK_RGB_blk_100217.svg",
    },
    {
      code: "ar",
      dir: "rtl",
      ogLocale: "ar_AR",
      path: "/ar/",
      nativeName: "العربية",
      appStoreStorefront: "sa",
      appStoreBadge:
        "images/Download-on-the-App-Store/AR/Download_on_App_Store/Black_lockup/SVG/Download_on_the_App_Store_Badge_AR_RGB_blk_102417.svg",
    },
  ],
};

/**
 * Prefix a site-root path with the GitHub Pages repo path when needed.
 * pagePath() still returns unprefixed paths for writing files to dist/.
 */
export function withBase(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") {
    return site.basePath ? `${site.basePath}/` : "/";
  }
  return `${site.basePath}${normalized}`;
}

export function absoluteUrl(path) {
  return new URL(withBase(path), `${site.origin}/`).href;
}

export function appStoreUrl(locale) {
  return `https://apps.apple.com/${locale.appStoreStorefront}/app/id${site.appStore.id}`;
}

/**
 * Path for a page in a given locale, relative to the site root
 * (not including SITE_BASE_PATH). Terms ignores the locale: there
 * is only an English document.
 */
export function pagePath(page, locale) {
  switch (page) {
    case "home":
      return locale.path;
    case "support":
      return locale.path === "/" ? "/support/" : `${locale.path}support/`;
    case "terms":
      return "/terms/";
    default:
      throw new Error(`Unknown page: ${page}`);
  }
}
