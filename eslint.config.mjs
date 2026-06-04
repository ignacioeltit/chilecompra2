import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Hacer las reglas de formato menos excluyentes: muchas bases de código usan distintos estilos.
  {
    // Reglas globales relajadas
    rules: {
      // Desactivar o dejar en warning reglas estrictas de formato
      'prettier/prettier': 'off',
      'max-len': ['warn', { code: 120 }],
      'no-console': 'off',
      'no-warning-comments': 'off',
      'sort-keys': 'off',
      'react/jsx-sort-props': 'off',
      // Bajar severidad de reglas de estilo comunes para permitir distintos formatos
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'semi': ['warn', 'always'],
      'indent': ['warn', 2],
      'comma-dangle': ['warn', 'always-multiline'],
    },
    // Overrides por tipo de archivo para aceptar convenciones diferentes por carpeta/proyecto
    overrides: [
      {
        files: ['**/*.{js,jsx}'],
        rules: {
          'quotes': ['warn', 'double', { avoidEscape: true }],
        }
      },
      {
        files: ['**/*.{ts,tsx}'],
        rules: {
          'quotes': ['warn', 'single', { avoidEscape: true }]
        }
      }
    ]
  }
]);

export default eslintConfig;
