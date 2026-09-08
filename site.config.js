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
 * English stays at `/` because this is a .com with English as the
 * default. Danish and Arabic get a directory prefix. Do not also
 * publish `/en/` — that would be duplicate content.
 */
export const site = {
  url: "https://helloworld.com",
  defaultLocale: "en",
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
