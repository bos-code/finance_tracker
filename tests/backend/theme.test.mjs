import assert from "node:assert/strict";
import test from "node:test";

import {
  EFFECT_LEVELS,
  FONT_SCALES,
  effectsOpacity,
  fontScaleValue,
  isEffectsLevel,
  isFontFamilyId,
  isFontScaleId,
  readableSize,
  scaleLineHeight,
  scaleText,
} from "../../src/theme/appearance-options.ts";
import {
  THEMES,
  THEME_IDS,
  contrastRatio,
  isThemeId,
} from "../../src/theme/themes.ts";

const SURFACES = ["canvas", "canvasRaised", "surface", "surfaceRaised"];
const SIGNALS = [
  "signalAmber",
  "signalViolet",
  "signalCyan",
  "signalMoss",
  "income",
  "expense",
  "warning",
  "info",
];

test("the contrast helper matches the WCAG reference values", () => {
  assert.equal(contrastRatio("#000000", "#FFFFFF").toFixed(1), "21.0");
  assert.equal(contrastRatio("#777777", "#FFFFFF").toFixed(2), "4.48");
  assert.equal(contrastRatio("#FFFFFF", "#FFFFFF").toFixed(1), "1.0");
});

for (const id of THEME_IDS) {
  const { palette } = THEMES[id];

  test(`${id}: body text is at least 7:1 on every surface`, () => {
    for (const surface of SURFACES) {
      const ratio = contrastRatio(palette.text, palette[surface]);
      assert.ok(ratio >= 7, `text on ${surface} is ${ratio.toFixed(2)}`);
    }
  });

  test(`${id}: muted and quiet text meet WCAG AA (4.5:1) on every surface`, () => {
    for (const surface of SURFACES) {
      for (const token of ["textMuted", "textQuiet"]) {
        const ratio = contrastRatio(palette[token], palette[surface]);
        assert.ok(ratio >= 4.5, `${token} on ${surface} is ${ratio.toFixed(2)}`);
      }
    }
  });

  test(`${id}: every signal colour meets WCAG AA on every surface`, () => {
    for (const surface of SURFACES) {
      for (const token of SIGNALS) {
        const ratio = contrastRatio(palette[token], palette[surface]);
        assert.ok(ratio >= 4.5, `${token} on ${surface} is ${ratio.toFixed(2)}`);
      }
    }
  });

  test(`${id}: text on a primary (text-coloured) fill is at least 7:1`, () => {
    const ratio = contrastRatio(palette.onPrimary, palette.text);
    assert.ok(ratio >= 7, `onPrimary on text is ${ratio.toFixed(2)}`);
  });

  test(`${id}: every colour is a plain #RRGGBB value`, () => {
    for (const [token, value] of Object.entries(palette)) {
      assert.match(value, /^#[0-9A-Fa-f]{6}$/, token);
    }
  });
}

test("every theme defines exactly the same colour tokens", () => {
  const reference = Object.keys(THEMES.obsidian.palette).sort();
  for (const id of THEME_IDS) {
    assert.deepEqual(Object.keys(THEMES[id].palette).sort(), reference, id);
  }
});

test("light and dark themes are flagged correctly, and tint always contrasts", () => {
  assert.equal(THEMES.daylight.isDark, false);
  for (const id of ["obsidian", "midnight", "contrast"]) {
    assert.equal(THEMES[id].isDark, true, id);
  }
  // `tint` lifts a surface: white on dark themes, black on the light theme.
  assert.ok(contrastRatio(THEMES.daylight.palette.tint, THEMES.daylight.palette.canvas) > 10);
  assert.ok(contrastRatio(THEMES.obsidian.palette.tint, THEMES.obsidian.palette.canvas) > 10);
});

test("the high-contrast theme forces decorative effects off", () => {
  assert.equal(THEMES.contrast.forceEffectsOff, true);
  for (const id of ["obsidian", "daylight", "midnight"]) {
    assert.equal(THEMES[id].forceEffectsOff, false, id);
  }
});

test("no text is ever drawn smaller than 11 px, even for the tiniest design sizes", () => {
  for (let size = 1; size <= 60; size += 1) {
    assert.ok(readableSize(size) >= 11, `size ${size} -> ${readableSize(size)}`);
    assert.ok(scaleText(size, 1) >= 11, `scaled size ${size}`);
  }
});

test("readable size never shrinks a size, never reorders sizes, and leaves display type alone", () => {
  let previous = 0;
  for (let size = 6; size <= 60; size += 1) {
    const next = readableSize(size);
    assert.ok(next >= previous, `non-decreasing at ${size}`);
    if (size >= 11) assert.ok(next >= size - 0, `${size} stays >= itself`);
    previous = next;
  }
  for (const size of [18, 24, 40, 44]) assert.equal(readableSize(size), size);
});

test("a bigger text setting never makes text smaller", () => {
  for (const size of [7, 9, 12, 15, 20, 28, 40]) {
    let last = 0;
    for (const { value } of FONT_SCALES) {
      const px = scaleText(size, value);
      assert.ok(px >= last, `size ${size} at ${value}`);
      last = px;
    }
  }
});

test("large headings grow less than body text so they still fit a phone", () => {
  const body = scaleText(14, 1.5) / readableSize(14);
  const display = scaleText(40, 1.5) / 40;
  assert.ok(display < body, `display x${display.toFixed(2)} vs body x${body.toFixed(2)}`);
  assert.ok(scaleText(40, 1.5) <= 40 * 1.3, "a 40 px heading stays under 52 px at the largest setting");
});

test("line height keeps the design's ratio to the font size", () => {
  const ratio = (fontSize, lineHeight, scale) =>
    scaleLineHeight(fontSize, lineHeight, scale) / scaleText(fontSize, scale);
  for (const scale of [1, 1.15, 1.3, 1.5]) {
    assert.ok(Math.abs(ratio(15, 22, scale) - 22 / 15) < 0.06, `15/22 at ${scale}`);
    assert.ok(Math.abs(ratio(28, 34, scale) - 34 / 28) < 0.06, `28/34 at ${scale}`);
  }
  assert.equal(scaleLineHeight(undefined, 20, 1.5), 30);
});

test("option ids are validated so a bad saved value cannot break the UI", () => {
  assert.equal(isThemeId("obsidian"), true);
  assert.equal(isThemeId("nope"), false);
  assert.equal(isThemeId(undefined), false);
  assert.equal(isFontScaleId("large"), true);
  assert.equal(isFontScaleId("huge"), false);
  assert.equal(isFontFamilyId("readable"), true);
  assert.equal(isFontFamilyId("comic"), false);
  assert.equal(isEffectsLevel("subtle"), true);
  assert.equal(isEffectsLevel("loud"), false);
  assert.equal(fontScaleValue("standard"), 1);
  assert.ok(fontScaleValue("largest") > fontScaleValue("larger"));
});

test("background effects: off is invisible and subtle is much quieter than the old default", () => {
  assert.equal(effectsOpacity("off"), 0);
  assert.ok(effectsOpacity("subtle") <= 0.25);
  assert.ok(effectsOpacity("full") > effectsOpacity("subtle"));
  assert.equal(EFFECT_LEVELS.length, 3);
});
