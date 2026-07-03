import { useEffect, useRef } from "react";

/**
 * Invisible Cloudflare Turnstile (same pattern as the ai-mms contact form):
 * the widget renders hidden on mount, runs the challenge automatically, and
 * delivers the token via callback — no user interaction, no visible box.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          size?: "normal" | "compact" | "flexible" | "invisible";
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
        }
      ) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

// Default is Cloudflare's "invisible, always passes" test key
const SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "1x00000000000000000000BB";

let scriptLoading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptLoading) {
    scriptLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Turnstile"));
      document.head.appendChild(s);
    });
  }
  return scriptLoading;
}

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        if (widgetId.current) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          size: "invisible",
          callback: onToken,
          "error-callback": () => onToken(""),
          // On expiry, reset so a fresh token is fetched automatically
          "expired-callback": () => {
            onToken("");
            if (widgetId.current && window.turnstile) {
              window.turnstile.reset(widgetId.current);
            }
          },
        });
      })
      .catch(() => onToken(""));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Invisible — occupies no layout space
  return <div ref={ref} className="hidden" aria-hidden="true" />;
}
