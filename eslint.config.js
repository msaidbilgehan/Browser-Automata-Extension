import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
// @ts-expect-error — eslint-config-prettier has no type declarations
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
export default tseslint.config({ ignores: ["dist/", "node_modules/", "crx/", "coverage/", "**/*.d.ts", "src/**/*.js"] }, eslint.configs.recommended, ...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked, {
    languageOptions: {
        globals: {
            ...globals.browser,
            chrome: "readonly",
        },
        parserOptions: {
            projectService: true,
            tsconfigRootDir: import.meta.dirname,
        },
    },
}, {
    plugins: {
        "react-hooks": reactHooks,
        "react-refresh": reactRefresh,
    },
    rules: {
        ...reactHooks.configs.recommended.rules,
        "react-refresh/only-export-components": [
            "warn",
            { allowConstantExport: true },
        ],
    },
}, eslintConfigPrettier);
