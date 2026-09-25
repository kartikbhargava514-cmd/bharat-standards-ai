export type Lang = { code: string; label: string; family: "en" | "indo" | "dravidian" };

export const LANGUAGES: Lang[] = [
  { code: "en", label: "English", family: "en" },
  { code: "hi", label: "हिन्दी (Hindi)", family: "indo" },
  { code: "bn", label: "বাংলা (Bengali)", family: "indo" },
  { code: "mr", label: "मराठी (Marathi)", family: "indo" },
  { code: "gu", label: "ગુજરાતી (Gujarati)", family: "indo" },
  { code: "pa", label: "ਪੰਜਾਬੀ (Punjabi)", family: "indo" },
  { code: "or", label: "ଓଡ଼ିଆ (Odia)", family: "indo" },
  { code: "as", label: "অসমীয়া (Assamese)", family: "indo" },
  { code: "ta", label: "தமிழ் (Tamil)", family: "dravidian" },
  { code: "te", label: "తెలుగు (Telugu)", family: "dravidian" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)", family: "dravidian" },
  { code: "ml", label: "മലയാളം (Malayalam)", family: "dravidian" },
];

export const LANG_CODES = LANGUAGES.map((l) => l.code);
