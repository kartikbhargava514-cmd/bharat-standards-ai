import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { translateTexts } from "./bhashini.functions";

type Ctx = { lang: string; setLang: (l: string) => void };
const LangContext = createContext<Ctx>({ lang: "en", setLang: () => {} });
export const useLang = () => useContext(LangContext);

const STORE = "bsa-lang";
const cacheKey = (l: string) => `bsa-tr-${l}`;

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState("en");
  useEffect(() => {
    const saved = localStorage.getItem(STORE);
    if (saved) setLangState(saved);
  }, []);
  const setLang = (l: string) => {
    localStorage.setItem(STORE, l);
    setLangState(l);
  };
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
      <DomTranslator lang={lang} />
    </LangContext.Provider>
  );
}

const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "NOSCRIPT"]);

/** Translates visible app text in place through Bhashini, with a local cache. */
function DomTranslator({ lang }: { lang: string }) {
  const translate = useServerFn(translateTexts);

  useEffect(() => {
    const originals = new WeakMap<Text, string>();
    const applied = new WeakMap<Text, string>();
    const tracked = new Set<Text>();
    let cache: Record<string, string> = {};
    try {
      cache = JSON.parse(localStorage.getItem(cacheKey(lang)) ?? "{}");
    } catch {
      cache = {};
    }
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const eligible = (n: Text) => {
      let el = n.parentElement;
      while (el) {
        if (SKIP.has(el.tagName) || el.hasAttribute("data-no-translate")) return false;
        el = el.parentElement;
      }
      return true;
    };

    const apply = (n: Text) => {
      const orig = originals.get(n);
      if (orig == null) return;
      const core = orig.trim();
      const target = lang === "en" ? orig : cache[core] ? orig.replace(core, cache[core]) : null;
      if (target != null && n.nodeValue !== target) {
        applied.set(n, target);
        n.nodeValue = target;
      }
    };

    const visit = (n: Text) => {
      const val = n.nodeValue ?? "";
      if (applied.get(n) === val) return;
      originals.set(n, val);
      tracked.add(n);
      const core = val.trim();
      if (lang === "en" || core.length < 2 || !/[A-Za-z]/.test(core) || !eligible(n)) {
        apply(n);
        return;
      }
      if (cache[core]) apply(n);
      else {
        pending.add(core);
        schedule();
      }
    };

    const flush = async () => {
      const batch = [...pending].slice(0, 120);
      batch.forEach((b) => pending.delete(b));
      if (!batch.length) return;
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) return; // signed out: keep original text, no request
        const { translations } = await translate({ data: { texts: batch, target: lang } });
        if (cancelled) return;
        batch.forEach((b, i) => (cache[b] = translations[i] ?? b));
        localStorage.setItem(cacheKey(lang), JSON.stringify(cache));
        tracked.forEach((n) => (n.isConnected ? apply(n) : tracked.delete(n)));
      } catch (e) {
        console.warn("Translation failed", e);
      }
      if (pending.size) schedule();
    };
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(flush, 250);
    }

    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) return visit(root as Text);
      const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = it.nextNode())) visit(n as Text);
    };

    walk(document.body);
    if (lang === "en") return;

    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "characterData") visit(m.target as Text);
        else m.addedNodes.forEach(walk);
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      obs.disconnect();
      // restore English before switching language
      tracked.forEach((n) => {
        const o = originals.get(n);
        if (o != null && n.isConnected) {
          applied.set(n, o);
          n.nodeValue = o;
        }
      });
    };
  }, [lang, translate]);

  return null;
}
