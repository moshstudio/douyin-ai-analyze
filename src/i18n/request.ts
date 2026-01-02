import { getRequestConfig } from "next-intl/server";
import { i18n, type Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Ensure the locale is valid
  if (!locale || !i18n.locales.includes(locale as Locale)) {
    locale = i18n.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`./locales/${locale}.json`)).default,
  };
});
