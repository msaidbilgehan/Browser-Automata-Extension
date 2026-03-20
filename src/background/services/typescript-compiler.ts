/**
 * TypeScript support stub (F16f).
 * Provides a basic strip-types approach for simple TypeScript code.
 * A real implementation would use esbuild WASM for full compilation.
 */

/** Result of TypeScript compilation */
export interface CompileResult {
  js: string;
  errors: string[];
}

/**
 * Check whether a code string contains TypeScript-specific syntax.
 * Looks for common TS patterns: type annotations, interfaces, generics, enums, etc.
 */
export function isTypeScriptCode(code: string): boolean {
  const tsPatterns: RegExp[] = [
    // Type annotations on variables/parameters: `x: string`, `(a: number)`
    /:\s*(?:string|number|boolean|void|never|unknown|null|undefined)\b/,
    // Interface declarations
    /\binterface\s+\w+/,
    // Type alias declarations
    /\btype\s+\w+\s*=/,
    // Generic angle brackets on functions/classes: `fn<T>`, `class Foo<T>`
    /(?:function|class|const|let|var)\s+\w+\s*</,
    // Enum declarations
    /\benum\s+\w+/,
    // as-casting: `x as string`
    /\bas\s+(?:string|number|boolean|const|unknown|never)\b/,
    // Non-null assertion: `x!.foo`
    /\w+!\./,
    // Access modifiers
    /\b(?:public|private|protected|readonly)\s+\w+/,
  ];

  return tsPatterns.some((pattern) => pattern.test(code));
}

/**
 * Strip TypeScript type annotations to produce valid JavaScript.
 * This is a best-effort stub — handles common cases but not all TS syntax.
 * A production implementation would use esbuild WASM.
 */
export function compileTypeScript(code: string): CompileResult {
  const errors: string[] = [];
  let js = code;

  try {
    // Remove `interface` blocks: `interface Foo { ... }`
    js = js.replace(/\binterface\s+\w+(?:\s+extends\s+\w+(?:\s*,\s*\w+)*)?\s*\{[^}]*\}/g, "");

    // Remove `type` alias declarations: `type Foo = ...;`
    js = js.replace(/\btype\s+\w+\s*=[^;]+;/g, "");

    // Remove `enum` declarations: `enum Foo { ... }`
    // Note: real enums produce JS values; stripping is lossy but this is a stub
    js = js.replace(/\benum\s+\w+\s*\{[^}]*\}/g, "");

    // Remove generic type parameters from functions/classes: `<T, U extends V>`
    js = js.replace(/(<[^>]+>)(?=\s*\()/g, "");

    // Remove type annotations from parameters: `(a: string, b: number)` → `(a, b)`
    js = js.replace(/(\w+)\s*:\s*[\w<>[|&?. \]]+(?=[,)])/g, "$1");

    // Remove return type annotations: `): string {` → `) {`
    js = js.replace(/\)\s*:\s*[\w<>[|&?. \]]+(?=\s*\{)/g, ")");

    // Remove variable type annotations: `const x: string =` → `const x =`
    js = js.replace(/((?:const|let|var)\s+\w+)\s*:\s*[\w<>[|&?. \]]+(?=\s*=)/g, "$1");

    // Remove `as` type assertions: `x as string` → `x`
    js = js.replace(/\s+as\s+[\w<>[|&?. \]]+/g, "");

    // Remove non-null assertions: `x!` → `x` (only when followed by `.` or `[`)
    js = js.replace(/(\w+)!(?=[.[])/, "$1");

    // Remove access modifiers: `public`, `private`, `protected`, `readonly`
    js = js.replace(/\b(?:public|private|protected|readonly)\s+/g, "");

    // Remove `import type` statements entirely
    js = js.replace(/import\s+type\s+[^;]+;\n?/g, "");

    // Remove type-only exports: `export type { ... };`
    js = js.replace(/export\s+type\s*\{[^}]*\}\s*;?\n?/g, "");

    // Clean up empty lines left behind
    js = js.replace(/\n{3,}/g, "\n\n");
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    errors.push(`TypeScript strip-types error: ${message}`);
  }

  if (errors.length === 0 && js.trim().length === 0 && code.trim().length > 0) {
    errors.push("TypeScript stripping produced empty output — code may need a full compiler");
  }

  return { js: js.trim(), errors };
}
