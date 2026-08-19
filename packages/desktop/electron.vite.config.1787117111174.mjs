// electron.vite.config.ts
import { resolve as resolve2, dirname } from "path";
import { defineConfig } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import svgLoader from "vite-svg-loader";
import postcssPresetEnv from "postcss-preset-env";

// package.json
var package_default = {
  name: "markweave",
  version: "1.0.0",
  description: "MarkWeave",
  main: "./out/main/index.js",
  homepage: "https://github.com/markweave/markweave",
  repository: {
    type: "git",
    url: "git+https://github.com/markweave/markweave.git"
  },
  scripts: {
    "minify-locales": "tsx ../../scripts/minify-locales.ts",
    "rebuild-native": "electron-rebuild -f",
    start: "cross-env PERF_TESTING=true electron-vite preview",
    dev: "electron-vite dev",
    build: "electron-vite build",
    "build:unpack": "tsx ../../scripts/minify-locales.ts && electron-vite build",
    "build:win": "tsx ../../scripts/minify-locales.ts && electron-rebuild -o ced,keytar && electron-vite build && electron-builder --win --x64 --publish never",
    "build:win:x64": "tsx ../../scripts/minify-locales.ts && electron-rebuild -o ced,keytar && electron-vite build && electron-builder --win --x64 --publish never",
    "build:win:arm64": "tsx ../../scripts/minify-locales.ts && electron-rebuild && electron-vite build && electron-builder --win --arm64 --publish never",
    "build:mac": "tsx ../../scripts/minify-locales.ts && electron-rebuild && electron-vite build && electron-builder --mac --publish never",
    "build:mac:x64": "tsx ../../scripts/minify-locales.ts && electron-rebuild && electron-vite build && electron-builder --mac --x64 --publish never",
    "build:mac:arm64": "tsx ../../scripts/minify-locales.ts && electron-rebuild && electron-vite build && electron-builder --mac --arm64 --publish never",
    "build:linux": "tsx ../../scripts/minify-locales.ts && electron-rebuild && electron-vite build && electron-builder --linux --publish never",
    "perf:inspect": "cross-env PERF_TESTING=true electron-vite preview -- --inspect=5858",
    "perf:inspect-brk": "cross-env PERF_TESTING=true electron-vite preview -- --inspect-brk=5858",
    test: "vitest run",
    "test:unit": "vitest run test/unit",
    "test:e2e": "playwright test test/e2e",
    typecheck: "vue-tsc --noEmit -p tsconfig.json",
    "typecheck:watch": "vue-tsc --noEmit -p tsconfig.json --watch"
  },
  dependencies: {
    "@electron-toolkit/preload": "^3.0.2",
    "@electron-toolkit/utils": "^4.0.0",
    "@element-plus/icons-vue": "^2.3.2",
    "@hfelix/electron-localshortcut": "^4.0.1",
    "@intlify/core-base": "^11.4.6",
    "@marktext/file-icons": "^1.0.6",
    "@marktext/muyajs": "workspace:*",
    "@muyajs/core": "workspace:*",
    "@popperjs/core": "^2.11.8",
    "@vscode/ripgrep": "^1.18.0",
    arg: "^5.0.2",
    axios: "^1.18.0",
    ced: "^2.0.0",
    chokidar: "^5.0.0",
    codemirror: "^5.65.21",
    "command-exists": "^1.2.9",
    "deep-equal": "^2.2.3",
    "dom-autoscroller": "^2.3.4",
    dompurify: "^3.4.11",
    dragula: "^3.7.3",
    "electron-log": "^5.4.4",
    "electron-store": "^11.0.2",
    "electron-updater": "^6.8.9",
    "electron-window-state": "^5.0.3",
    "element-plus": "^2.14.2",
    "element-resize-detector": "^1.2.4",
    execall: "^3.0.0",
    "flowchart.js": "^1.18.0",
    "font-list": "^2.1.0",
    "fs-extra": "^11.3.5",
    fuzzaldrin: "^2.1.0",
    "github-markdown-css": "^5.9.0",
    "html-tags": "^5.1.0",
    "iso-639-1": "^3.1.5",
    "joplin-turndown-plugin-gfm": "^1.0.12",
    katex: "^0.17.0",
    keytar: "^7.9.0",
    lodash: "^4.18.1",
    mermaid: "^11.15.0",
    mitt: "^3.0.1",
    ms: "^2.1.3",
    pako: "^2.1.0",
    pathe: "^2.0.3",
    pinia: "^3.0.4",
    plist: "^5.0.0",
    prismjs: "^1.30.0",
    snabbdom: "^3.6.4",
    "snabbdom-to-html": "^7.1.0",
    "snapsvg-cjs": "^0.0.6",
    turndown: "^7.2.4",
    underscore: "^1.13.8",
    "vega-embed": "^7.1.0",
    "vue-i18n": "^11.4.6",
    "vue-router": "^4.6.4",
    webfontloader: "^1.6.28",
    "write-file-atomic": "^7.0.1"
  },
  optionalDependencies: {
    "native-keymap": "^3.3.9"
  },
  devDependencies: {
    "@electron/rebuild": "^4.0.4",
    "@playwright/test": "^1.61.0",
    "@types/codemirror": "^5.60.17",
    "@types/deep-equal": "^1.0.4",
    "@types/dragula": "^3.7.5",
    "@types/element-resize-detector": "^1.1.6",
    "@types/fs-extra": "^11.0.4",
    "@types/fuzzaldrin": "^2.1.7",
    "@types/lodash": "^4.17.24",
    "@types/ms": "^2.1.0",
    "@types/node": "^22.20.0",
    "@types/turndown": "^5.0.6",
    "@types/webfontloader": "^1.6.38",
    "@types/write-file-atomic": "^4.0.3",
    "@vitejs/plugin-vue": "^6.0.7",
    "@vitest/coverage-v8": "^4.1.9",
    "cross-env": "^10.1.0",
    electron: "~42.1.0",
    "electron-builder": "^26.15.3",
    "electron-vite": "^5.0.0",
    "javascript-obfuscator": "^5.5.0",
    jsdom: "^29.1.1",
    "patch-package": "^8.0.1",
    "postcss-preset-env": "^11.3.1",
    tsx: "^4.22.4",
    typescript: "^6.0.3",
    vite: "^7.3.5",
    "vite-svg-loader": "^5.1.1",
    vitest: "^4.1.9",
    vue: "^3.5.38",
    "vue-tsc": "^3.3.5"
  }
};

// electron.vite.config.ts
import { fileURLToPath } from "url";

// src/build/obfuscate.ts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import obfuscator from "javascript-obfuscator";
var OBJ_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.3,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  renameProperties: false,
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 0.95,
  splitStrings: true,
  splitStringsChunkLength: 10,
  numbersToExpressions: true,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  transformObjectKeys: false,
  unicodeEscapeSequence: false
};
function obfuscateBundle(outDir, bundleFile) {
  return {
    name: "markweave:obfuscate-bundle",
    apply: (_config, env) => env.mode === "production" && env.command === "build",
    enforce: "post",
    closeBundle() {
      const filePath = resolve(outDir, bundleFile);
      let code;
      try {
        code = readFileSync(filePath, "utf8");
      } catch (err) {
        console.warn("[obfuscate] \u8DF3\u8FC7\uFF08\u6587\u4EF6\u4E0D\u5B58\u5728\uFF09:", filePath);
        return;
      }
      console.log(`[obfuscate] \u6DF7\u6DC6\u4E2D: ${filePath} (${(code.length / 1024).toFixed(0)} KB)`);
      const started = Date.now();
      const result = obfuscator.obfuscate(code, OBJ_OPTIONS);
      writeFileSync(filePath, result.getObfuscatedCode());
      console.log(`[obfuscate] \u5B8C\u6210: ${filePath} (\u8017\u65F6 ${((Date.now() - started) / 1e3).toFixed(1)}s)`);
    }
  };
}

// electron.vite.config.ts
var __electron_vite_injected_import_meta_url = "file:///D:/marktext-develop/packages/desktop/electron.vite.config.ts";
var __filename = fileURLToPath(__electron_vite_injected_import_meta_url);
var __dirname = dirname(__filename);
var OUT_DIR = resolve2(__dirname, "out");
var electron_vite_config_default = defineConfig({
  main: {
    // --> Bundled as CommonJS
    // externalizeDepsPlugin() basically externises all the dependencies from being bundled during build - treating them as runtime dependencies
    // electron-vite still builds the main and preload processes into commonJS
    // hence, we need to "exclude" (in order to NOT externalise) ESonly modules so that they can be converted to commonJS and can be required() afterwards correctly
    build: {
      externalizeDeps: {
        // Bundle electron-store + plist inline so they are available as a
        // CommonJS require() after electron-vite converts the main process
        // output. plist 5 ships ESM-only (no CJS `exports` entry), so leaving
        // it externalized makes the main process `require('plist')` throw
        // ERR_PACKAGE_PATH_NOT_EXPORTED at startup.
        exclude: ["electron-store", "plist", "@markweave/license-core"],
        include: ["native-keymap"]
      }
    },
    plugins: [obfuscateBundle(OUT_DIR, "main/index.js")],
    define: {
      MARKTEXT_VERSION: JSON.stringify(package_default.version),
      MARKTEXT_VERSION_STRING: JSON.stringify(`v${package_default.version}`)
    },
    resolve: {
      alias: {
        "@": resolve2(__dirname, "src/renderer/src"),
        common: resolve2(__dirname, "src/common"),
        muya: resolve2(__dirname, "../muyajs"),
        "@shared": resolve2(__dirname, "src/shared")
      },
      extensions: [".mjs", ".ts", ".js", ".json"]
    }
  },
  preload: {
    // --> Bundled as CommonJS
    // With sandbox: true the renderer's preload can only `require('electron')`
    // (plus a few built-ins). Inline `pathe` (ESM-only) so the bundled preload
    // doesn't try to require it from node_modules at runtime.
    build: {
      externalizeDeps: {
        exclude: ["pathe"]
      }
    },
    plugins: [obfuscateBundle(OUT_DIR, "preload/index.js")],
    resolve: {
      alias: {
        "@": resolve2(__dirname, "src/renderer/src"),
        common: resolve2(__dirname, "src/common"),
        muya: resolve2(__dirname, "../muyajs"),
        "@shared": resolve2(__dirname, "src/shared")
      },
      extensions: [".mjs", ".ts", ".js", ".json"]
    }
  },
  renderer: {
    // --> Bundled as ES Modules
    // The renderer runs in a sandboxed Chromium context (contextIsolation: true,
    // nodeIntegration: false, sandbox: true). All Node access must go through
    // the preload → IPC bridge. Aliasing `path` → `pathe` lets the shared
    // `common/*` helpers and muya keep their `import path from 'path'`
    // statements without pulling in Node's path module. `pathe` always uses
    // `/` separators and handles Windows drive letters correctly.
    assetsInclude: ["**/*.md"],
    // Some bundled deps (e.g. `custom-event` via `dragula`) reference the
    // Node-only `global` at module load — undefined in a sandboxed renderer.
    // Substitute it with `globalThis` at build time so the imports don't
    // throw before Vue mounts.
    define: {
      global: "globalThis"
    },
    resolve: {
      alias: {
        "@": resolve2(__dirname, "src/renderer/src"),
        common: resolve2(__dirname, "src/common"),
        muya: resolve2(__dirname, "../muyajs"),
        "@shared": resolve2(__dirname, "src/shared"),
        path: "pathe"
      },
      extensions: [".mjs", ".ts", ".js", ".json", ".vue"]
    },
    optimizeDeps: {
      include: ["pako", "pathe"],
      esbuildOptions: {
        define: {
          global: "globalThis"
        }
      }
    },
    plugins: [vue(), svgLoader()],
    css: {
      postcss: {
        plugins: [
          postcssPresetEnv({
            stage: 0,
            features: {
              "nesting-rules": true,
              // Electron ships Chromium, which supports CSS logical properties
              // natively. Leave them untouched so `padding-inline-start` /
              // `inset-inline-start` mirror correctly under `dir="rtl"` instead
              // of being down-compiled to hard-coded LTR physical props (#4673).
              "logical-properties-and-values": false
            }
          })
        ]
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
