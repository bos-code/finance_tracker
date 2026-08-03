import assert from "node:assert/strict";
import test from "node:test";

import {
  countryFromLocale,
  currencyForCountry,
} from "../../src/features/profile/region-defaults.ts";

test("extracts a stable country from standard and underscored locales", () => {
  assert.equal(countryFromLocale("en-NG"), "NG");
  assert.equal(countryFromLocale("en_US"), "US");
  assert.equal(countryFromLocale("ja-Jpan-JP"), "JP");
  assert.equal(countryFromLocale("en"), null);
});

test("maps supported regions without guessing an unsupported currency", () => {
  assert.equal(currencyForCountry("NG"), "NGN");
  assert.equal(currencyForCountry("gb"), "GBP");
  assert.equal(currencyForCountry("DE"), "EUR");
  assert.equal(currencyForCountry("BG"), "EUR");
  assert.equal(currencyForCountry("VA"), "EUR");
  assert.equal(currencyForCountry("CA"), null);
  assert.equal(currencyForCountry(null), null);
});
