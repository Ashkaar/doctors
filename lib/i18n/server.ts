import "server-only";
import { cookies } from "next/headers";
import { currentShop } from "../tenant";
import { DEFAULT_LANG, isLang, LANG_COOKIE, MESSAGES, type Lang, type Messages } from "./index";

// The visitor's language on the server (layouts, API error messages): the
// one chosen on this device, else the clinic's language from Ariloo (or
// SHOP_LANG in single-clinic mode), else English.
export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(value)) return value;
  try {
    const shop = await currentShop();
    const lang = shop ? shop.lang : process.env.SHOP_LANG;
    if (isLang(lang)) return lang;
  } catch {
    // No such clinic: the page says so, in the default language.
  }
  return DEFAULT_LANG;
}

export async function getMessages(): Promise<Messages> {
  return MESSAGES[await getLang()];
}
