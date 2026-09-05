import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import header from "./locales/header.json";
type Language = keyof typeof header;
// Build resources from single files
const resources: any = {};

(["en", "hi", "gu", "ta", "te", "bn", "mr", "kn", "ml", "pa", "or"] as Language[]).forEach((lang) => {
  resources[lang] = {
    header: header[lang],
  };
});

const savedLang = "en";


i18n.use(initReactI18next).init({
  resources,
  lng: savedLang, // default
  fallbackLng: "en",
  ns: ["header", "home"],
  defaultNS: "header",
  interpolation: { escapeValue: false },
});

export default i18n;
