#!/usr/bin/env node
/**
 * scripts/postinstall.mjs
 *
 * pnpm creates hollow stubs for transitive peer deps inside the WXT virtual
 * store.  WXT's own ESM files (inside .pnpm/wxt@…/) try to resolve those
 * deps relative to their own path and hit the stubs instead of the real
 * hoisted copies in the top-level node_modules.
 *
 * This script replaces each known hollow stub with a symlink to the real
 * hoisted package so ESM import resolution succeeds.
 *
 * Run automatically via package.json "postinstall" hook.
 */

import { existsSync, readdirSync, rmSync, symlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pnpmVirtual = join(root, "node_modules", ".pnpm");

if (!existsSync(pnpmVirtual)) process.exit(0);

// Scoped / unscoped packages that are hollow stubs in the WXT virtual store
// but need to resolve to the real hoisted copy in node_modules/.
const STUBS_TO_LINK = ["@webext-core/fake-browser"];

let wxtDirs;
try {
    wxtDirs = readdirSync(pnpmVirtual).filter((d) => d.startsWith("wxt@"));
} catch {
    process.exit(0);
}

for (const wxtDir of wxtDirs) {
    for (const pkg of STUBS_TO_LINK) {
        const realDir = join(root, "node_modules", pkg);
        if (!existsSync(realDir)) continue;

        // Build stub path inside virtual store
        const parts = pkg.split("/");
        const stubDir =
            parts.length === 2
                ? join(pnpmVirtual, wxtDir, "node_modules", parts[0], parts[1])
                : join(pnpmVirtual, wxtDir, "node_modules", parts[0]);

        const stubHasLib = existsSync(join(stubDir, "lib"));
        if (stubHasLib) continue; // already real or already linked

        try {
            if (existsSync(stubDir)) {
                rmSync(stubDir, { recursive: true, force: true });
            }

            // Ensure parent scope dir exists (e.g. @webext-core)
            if (parts.length === 2) {
                mkdirSync(join(pnpmVirtual, wxtDir, "node_modules", parts[0]), {
                    recursive: true,
                });
            }

            symlinkSync(realDir, stubDir);
            console.log(`[postinstall] Linked stub: ${pkg} → ${realDir}`);
        } catch (err) {
            console.error(
                `[postinstall] Failed to link ${pkg}: ${err.message}`,
            );
            process.exit(1);
        }
    }
}
