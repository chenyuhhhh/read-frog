import type { Plugin } from "vite"
import path from "node:path"
import process from "node:process"
import { defineConfig } from "wxt"
import { z } from "zod"
import { createExtensionClientEnvSchema, isLocalPackagesEnabled, resolveExtensionEnv } from "./src/env/shared"

const WXT_API_KEY_PATTERN = /^WXT_.*API_KEY/
const ALLOWED_BUNDLED_API_KEYS = new Set([
  "WXT_POSTHOG_API_KEY",
])
const useLocalPackages = isLocalPackagesEnabled(process.env)
const shouldSkipEnvValidation = process.env.WXT_SKIP_ENV_VALIDATION === "true"

type JavaScriptBundleOutput
  = | { type: "chunk", code: string }
    | { type: "asset", fileName: string, source: string | Uint8Array }

function escapeNonAsciiJavaScript(code: string) {
  let escapedCode = ""

  for (const char of code) {
    const codePoint = char.codePointAt(0)
    if (codePoint == null || codePoint <= 0x7F) {
      escapedCode += char
      continue
    }

    if (codePoint <= 0xFFFF) {
      escapedCode += `\\u${codePoint.toString(16).padStart(4, "0")}`
      continue
    }

    escapedCode += `\\u{${codePoint.toString(16)}}`
  }

  return escapedCode
}

function isJavaScriptBundleOutput(output: unknown): output is JavaScriptBundleOutput {
  if (typeof output !== "object" || output == null || !("type" in output))
    return false

  if (output.type === "chunk")
    return "code" in output && typeof output.code === "string"

  if (output.type === "asset") {
    return "fileName" in output
      && typeof output.fileName === "string"
      && "source" in output
      && (typeof output.source === "string" || output.source instanceof Uint8Array)
  }

  return false
}

function asciiOnlyJavaScriptBundlePlugin(): Plugin {
  return {
    name: "ascii-only-javascript-bundle",
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      for (const output of Object.values(bundle)) {
        if (!isJavaScriptBundleOutput(output))
          continue

        if (output.type === "chunk") {
          output.code = escapeNonAsciiJavaScript(output.code)
        }
        else if (output.fileName.endsWith(".js") && typeof output.source === "string") {
          output.source = escapeNonAsciiJavaScript(output.source)
        }
      }
    },
  }
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  imports: false,
  modules: ["@wxt-dev/module-react", "@wxt-dev/i18n/module"],
  manifestVersion: 3,
  // WXT top level alias - will be automatically synced to tsconfig.json paths and Vite alias
  alias: useLocalPackages
    ? {
        "@read-frog/definitions": path.resolve(__dirname, "../read-frog-monorepo/packages/definitions/src"),
        "@read-frog/api-contract": path.resolve(__dirname, "../read-frog-monorepo/packages/api-contract/src"),
      }
    : {},
  manifest: ({ mode, browser }) => ({
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    // Fixed extension ID for development
    ...(mode === "development" && (browser === "chrome" || browser === "edge") && {
      key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw2KhiXO2vySZtPu5pNSbyKhYavh8Be7gXmCZt8aJf6tQ/L3JK0qzL+3JSc/o20td3Jw+B2Dcw+EI93NAZr24xKnTNXQiJpuIuHb8xLXD0Ra/HrTVi4TJIhPdESogoG4uL6CD/F3TxfZJ2trX4Bt9cdAw1RGGeU+xU0g+YFfEka4ZUCpFAmTEw9H3/DU+nCp8yGaJWyiVgCTcFe38GZKEPt0iMJkTw956wz/iiafLx0pNG/RaztG9cAPoQOD2+SMFaeQ+b/G4OG17TYhzb09AhNBl6zSJ3jTKHSwuedCFwCce8Q/EchJfQZv71mjAE97bzwvkDYPCLj31Z5FE8HntMwIDAQAB",
    }),
    permissions: [
      "storage",
      "tabs",
      "alarms",
      "cookies",
      "contextMenus",
      "identity",
      "scripting",
      "webNavigation",
      ...(browser !== "firefox" ? ["offscreen", "sidePanel"] : []),
    ],
    host_permissions: [
      "*://*/*", // Required for scripting.executeScript in any frame
    ],
    // Allow images/SVGs referenced by content-script UI <img> tags to be loaded from
    // moz-extension:// URLs on regular pages. Firefox enforces this more strictly.
    web_accessible_resources: [
      {
        resources: ["assets/*.png", "assets/*.svg", "assets/*.webp"],
        matches: ["*://*/*", "file:///*"],
      },
    ],
    // Firefox-specific settings for MV3
    ...(browser === "firefox" && {
      // Override default CSP to exclude `upgrade-insecure-requests` (Firefox MV3 default),
      // which would upgrade custom provider HTTP URLs (e.g. LAN) to HTTPS.
      content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
      },
      browser_specific_settings: {
        gecko: {
          id: "{bd311a81-4530-4fcc-9178-74006155461b}",
          strict_min_version: "112.0",
          data_collection_permissions: {
            required: ["none"],
            optional: ["technicalAndInteraction"],
          },
        },
      },
    }),
  }),
  zip: {
    includeSources: [".env.production"],
    excludeSources: ["docs/**/*", "assets/**/*", "repos/**/*"],
  },
  dev: {
    server: {
      // Prefer 3333 over WXT's default 3000 while still allowing WXT to pick
      // another open port when 3333 is already taken.
      port: 3333,
      strictPort: false,
    },
  },
  vite: configEnv => ({
    plugins: [
      asciiOnlyJavaScriptBundlePlugin(),
      ...(configEnv.mode === "production"
        ? [
            {
              name: "check-api-key-env",
              buildStart() {
                z.object(createExtensionClientEnvSchema(
                  configEnv.mode === "production",
                  shouldSkipEnvValidation,
                ))
                  .parse(resolveExtensionEnv(process.env))

                const apiKeyVars = Object.keys(process.env)
                  .filter(key => WXT_API_KEY_PATTERN.test(key))
                  .filter(key => !ALLOWED_BUNDLED_API_KEYS.has(key))

                if (apiKeyVars.length > 0) {
                  throw new Error(
                    `\n\nFound WXT_*_API_KEY environment variables that may be bundled:\n`
                    + `${apiKeyVars.map(k => `   - ${k}`).join("\n")}\n\n`
                    + `Please unset these variables before building for production.\n`,
                  )
                }
              },
            },
          ]
        : []),
    ],
  }),
})
