import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      /**
       * Cover, Moodboard-Bilder und Zeichnungen kommen aus wechselnden Quellen
       * (externe Cover-URLs, /api/media, PNG-Data-URLs) und brauchen einen
       * eigenen Fehler-Fallback – deshalb bewusst <img> statt next/image.
       */
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "data/**",
      "public/sw.js",
      "scripts/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
