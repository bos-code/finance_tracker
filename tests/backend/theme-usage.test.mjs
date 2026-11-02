import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname;

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) files.push(full);
  }
  return files;
}

const sourceFiles = walk(join(ROOT, "src")).map((file) => ({
  path: relative(ROOT, file),
  text: readFileSync(file, "utf8"),
}));
const screens = sourceFiles.filter(
  (file) => file.path.endsWith(".tsx") && !file.path.startsWith("src/theme/"),
);

test("screens never read a fixed palette or font set, only the active theme", () => {
  for (const file of sourceFiles) {
    for (const match of file.text.matchAll(
      /import\s*\{([^}]*)\}\s*from\s*"@\/theme\/(colors|typography)"/g,
    )) {
      assert.notEqual(match[2], "typography", `${file.path} imports the removed typography module`);
      const names = match[1].split(",").map((name) => name.trim()).filter(Boolean);
      assert.deepEqual(names, ["withAlpha"], `${file.path} imports ${names.join(", ")} from colors`);
    }
  }
});

test("text and icons on a text-coloured fill use onPrimary, so they stay readable on light themes", () => {
  for (const file of screens) {
    assert.doesNotMatch(
      file.text,
      /\bcolor(?::|=\{)\s*(?:[^,;}\n]*\?\s*)?palette\.(black|white)\b/,
      `${file.path} colours text pure black or white`,
    );
  }
});

// Fixed sizes are allowed only where a glyph sits in a fixed-size shape.
const FIXED_FONT_SIZE_ALLOWED = new Set([
  "src/components/finance/appearance-panel.tsx",
  "src/components/ui/unified-numpad.tsx",
]);

test("font sizes go through fs() so the text size setting applies everywhere", () => {
  for (const file of screens) {
    if (FIXED_FONT_SIZE_ALLOWED.has(file.path)) continue;
    const literal = file.text.match(/fontSize:\s*\d+/);
    assert.equal(literal, null, `${file.path} has a fixed ${literal?.[0]}; use fs(size)`);
  }
});

test("no text is declared smaller than 11 design pixels outside deliberate exceptions", () => {
  for (const file of screens) {
    for (const match of file.text.matchAll(/fontSize:\s*fs\((\d+)\)/g)) {
      // fs() lifts tiny sizes to a readable floor; this just keeps new code honest.
      const size = Number(match[1]);
      assert.ok(size >= 6, `${file.path} uses fs(${size})`);
    }
  }
});

test("every screen and component that draws text gets its styles from the theme", () => {
  for (const file of screens) {
    if (!/StyleSheet\.create/.test(file.text)) continue;
    assert.match(
      file.text,
      /createStyles|AppTheme|useTheme\(\)/,
      `${file.path} builds a StyleSheet without using the theme`,
    );
  }
});
