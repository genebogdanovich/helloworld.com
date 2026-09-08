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
 *   English (default)  https://helloworld.com/
 *   Danish             https://helloworld.com/da/
 *   Arabic             https://helloworld.com/ar/
 *
 * Localized inner pages follow the same prefix:
 *   Support            /support/   /da/support/   /ar/support/
 *
 * Untranslated pages get one URL, not a copy per language:
 *   Terms              /terms/
 *
 * English stays at `/` because this is a .com with English as the
 * default. Danish and Arabic get a directory prefix. Do not also
 * publish `/en/` — that would be duplicate content.
 */
export const site = {
  url: "https://helloworld.com",
  defaultLocale: "en",
  supportEmail: "hello@example.com",
  locales: [
    {
      code: "en",
      dir: "ltr",
      ogLocale: "en_US",
      path: "/",
      nativeName: "English",
    },
    {
      code: "da",
      dir: "ltr",
      ogLocale: "da_DK",
      path: "/da/",
      nativeName: "Dansk",
    },
    {
      code: "ar",
      dir: "rtl",
      ogLocale: "ar_AR",
      path: "/ar/",
      nativeName: "العربية",
    },
  ],
};

export function absoluteUrl(path) {
  return new URL(path, `${site.url}/`).href;
}

/**
 * Path for a page in a given locale.
 * Terms ignores the locale: there is only an English document.
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
