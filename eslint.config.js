import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Accesibilidad estática del JSX (etiquetas, roles, eventos de teclado...).
    // Las comprobaciones con el DOM pintado las hace axe en los tests
    files: ["**/*.tsx"],
    ...jsxA11y.flatConfigs.recommended,
    settings: {
      // Que las reglas traten los componentes de shadcn como el elemento que pintan
      "jsx-a11y": {
        components: { Button: "button", Input: "input", Textarea: "textarea", Label: "label" },
      },
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // autoFocus solo se usa para llevar el foco al campo principal justo después
      // de una acción del usuario (abrir un diálogo, desbloquear la bóveda, pedir
      // el código de doble factor), que es lo que se espera en esos casos; nunca
      // al cargar una página
      "jsx-a11y/no-autofocus": "off",
    },
  },
  {
    // Los componentes de shadcn exportan sus variantes y los contextos su hook
    files: ["src/components/ui/**/*.tsx", "src/contexts/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
);
