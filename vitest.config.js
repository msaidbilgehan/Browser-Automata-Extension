import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./tests/setup.ts"],
        include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "src/**/*.test.{ts,tsx}",
                "src/**/index.ts",
                "src/vite-env.d.ts",
            ],
        },
    },
});
