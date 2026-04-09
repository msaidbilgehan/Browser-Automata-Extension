/**
 * CSP-Safe Code Execution Utilities
 *
 * Sites with strict Content Security Policy (e.g. Instagram) block `eval()` and
 * `new Function()`. These helpers try `new Function()` first (fast, synchronous)
 * and fall back to blob: URL `<script>` injection when CSP blocks eval.
 *
 * Blob URLs are widely allowed in CSP (`blob:` in `script-src`) even when
 * `unsafe-eval` is absent, making this a reliable fallback.
 *
 * IMPORTANT: These functions run inside page context via
 * chrome.scripting.executeScript — they must be fully self-contained with
 * no free variables or module imports.
 */

/**
 * Execute a code string as a function body (statements with optional `return`).
 * Falls back to blob: URL injection when CSP blocks `new Function()`.
 *
 * Equivalent to `new Function(code)()` but CSP-safe.
 */
export async function cspSafeExecStatements(code: string): Promise<unknown> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
    return new Function(code)() as unknown;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("Content Security Policy")) throw err;
  }

  // CSP blocks eval — fall back to blob: URL script injection
  const key = "__ba_r_" + Math.random().toString(36).slice(2);

  return new Promise<unknown>((resolve, reject) => {
    // Wrap code in an IIFE so `return` statements work (blob scripts
    // run as global code, not inside a function body).
    const wrapped =
      "try{var __ba_v=(function(){" +
      code +
      "\n})();window[" +
      JSON.stringify(key) +
      "]={ok:!0,v:__ba_v};}catch(__ba_e){window[" +
      JSON.stringify(key) +
      "]={ok:!1,e:__ba_e.message||String(__ba_e),s:__ba_e.stack};}";

    const blob = new Blob([wrapped], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    const el = document.createElement("script");
    el.src = blobUrl;

    el.onload = () => {
      URL.revokeObjectURL(blobUrl);
      el.remove();
      const w = window as unknown as Record<string, unknown>;
      const res = w[key] as
        | { ok: boolean; v?: unknown; e?: string; s?: string }
        | undefined;
      Reflect.deleteProperty(w, key);

      if (!res || res.ok) {
        resolve(res?.v);
      } else {
        const error = new Error(res.e ?? "Unknown error");
        if (res.s) error.stack = res.s;
        reject(error);
      }
    };

    el.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      el.remove();
      Reflect.deleteProperty(window as unknown as Record<string, unknown>, key);
      reject(
        new Error("Script blocked by Content Security Policy (eval and blob: URL both denied)"),
      );
    };

    document.head.appendChild(el);
  });
}

/**
 * Execute a code string as an expression and return its value.
 * Falls back to blob: URL injection when CSP blocks `new Function()`.
 *
 * Equivalent to `new Function('return ' + code)()` but CSP-safe.
 */
export async function cspSafeExecExpression(code: string): Promise<unknown> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
    return new Function(`return ${code}`)() as unknown;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("Content Security Policy")) throw err;
  }

  // CSP blocks eval — fall back to blob: URL script injection
  const key = "__ba_r_" + Math.random().toString(36).slice(2);

  return new Promise<unknown>((resolve, reject) => {
    const wrapped =
      "try{window[" +
      JSON.stringify(key) +
      "]={ok:!0,v:(" +
      code +
      ")};}catch(__ba_e){window[" +
      JSON.stringify(key) +
      "]={ok:!1,e:__ba_e.message||String(__ba_e),s:__ba_e.stack};}";

    const blob = new Blob([wrapped], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    const el = document.createElement("script");
    el.src = blobUrl;

    el.onload = () => {
      URL.revokeObjectURL(blobUrl);
      el.remove();
      const w = window as unknown as Record<string, unknown>;
      const res = w[key] as
        | { ok: boolean; v?: unknown; e?: string; s?: string }
        | undefined;
      Reflect.deleteProperty(w, key);

      if (!res || res.ok) {
        resolve(res?.v);
      } else {
        const error = new Error(res.e ?? "Unknown error");
        if (res.s) error.stack = res.s;
        reject(error);
      }
    };

    el.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      el.remove();
      Reflect.deleteProperty(window as unknown as Record<string, unknown>, key);
      reject(
        new Error("Script blocked by Content Security Policy (eval and blob: URL both denied)"),
      );
    };

    document.head.appendChild(el);
  });
}
