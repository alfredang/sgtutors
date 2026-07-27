import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";

interface ProvidersResponse {
  google: boolean;
  apple: boolean;
  googleClientId: string | null;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(opts: {
            client_id: string;
            callback: (r: { credential: string }) => void;
            ux_mode?: string;
          }): void;
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
        };
      };
    };
  }
}

/**
 * "Sign in with Google" for tutor accounts (web).
 *
 * Uses Google Identity Services, which hands us an ID token in-browser; the
 * server verifies it. Renders nothing when Google isn't configured, so the
 * login page degrades cleanly in dev and in deployments without OAuth keys.
 *
 * Apple sign-in is intentionally not offered here — it is required only in the
 * iOS app (App Store Guideline 4.8), which calls /api/auth/social/apple with a
 * token from the native SDK.
 */
export function GoogleSignIn({
  onSuccess,
  onError,
}: {
  /** Called after the session cookie is set — must refresh auth state. */
  onSuccess: () => void | Promise<void>;
  onError?: (msg: string) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  /** GSI is a global singleton — initialize() must run once per client id. */
  const initialised = useRef(false);

  /* Keep the latest callbacks in refs so the mount effect doesn't re-run when
     the parent passes new inline function identities on each render. */
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    void api
      .get<ProvidersResponse>("/api/auth/social/providers")
      .then((p) => setClientId(p.google ? p.googleClientId : null))
      .catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId || !holder.current) return;

    const mount = () => {
      if (!window.google || !holder.current) return;
      // React 18 StrictMode double-invokes effects in dev; without this guard
      // GSI logs "initialize() is called multiple times".
      if (initialised.current) return;
      initialised.current = true;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          try {
            await api.post("/api/auth/social/google", { idToken: response.credential });
            await onSuccessRef.current();
          } catch (err) {
            const msg =
              err instanceof ApiError && err.status === 404
                ? "No tutor account matches that Google account. Please sign up first — it's free."
                : "Google sign-in failed. Please try again.";
            onErrorRef.current?.(msg);
          }
        },
      });
      window.google.accounts.id.renderButton(holder.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "signin_with",
        shape: "pill",
      });
    };

    if (window.google) {
      mount();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", mount);
      return () => existing.removeEventListener("load", mount);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = mount;
    document.head.appendChild(script);
  }, [clientId]);

  if (!clientId) return null;

  return (
    <div className="mt-6">
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            or
          </span>
        </div>
      </div>
      <div ref={holder} className="mt-4 flex justify-center" />
    </div>
  );
}
