import assert from "node:assert/strict";
import test from "node:test";

import {
  calcCategoryBreakdown,
  calcDailyTotals,
  calcMonthSummary,
  transactionsForBaseCurrency,
} from "../../src/features/transactions/analytics.ts";

function transaction(overrides = {}) {
  return {
    amount: 1,
    account_id: "account-1",
    base_amount: 1,
    base_currency_code: "USD",
    category_id: "other",
    created_at: "2026-08-03T12:00:00.000Z",
    id: crypto.randomUUID(),
    currency_code: "USD",
    exchange_rate: 1,
    note: "",
    transaction_date: "2026-08-03",
    type: "Expenditure",
    user_id: "user-1",
    workspace_id: "workspace-1",
    ...overrides,
  };
}

const records = [
  transaction({ amount: 250, category_id: "salary", type: "Revenue" }),
  transaction({ amount: 50, category_id: "food" }),
  transaction({
    amount: 25,
    category_id: "food",
    transaction_date: "2026-08-04",
  }),
  transaction({
    amount: 75,
    category_id: "transport",
    transaction_date: "2026-08-04",
  }),
];

test("month summary derives totals only from supplied records", () => {
  assert.deepEqual(calcMonthSummary(records), {
    remaining: 100,
    totalExpenditure: 150,
    totalRevenue: 250,
  });
});

test("reporting excludes incompatible bases and uses stored base amounts", () => {
  const normalized = transactionsForBaseCurrency(
    [
      transaction({
        amount: 1_000,
        base_amount: 650,
        base_currency_code: "USD",
        currency_code: "EUR",
      }),
      transaction({
        amount: 20_000,
        base_amount: 20_000,
        base_currency_code: "NGN",
        currency_code: "NGN",
      }),
    ],
    "USD",
  );

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].amount, 650);
  assert.equal(normalized[0].currency_code, "EUR");
});

test("daily totals keep revenue and expenditure separate", () => {
  assert.deepEqual(calcDailyTotals(records), {
    "2026-08-03": {
      date: "2026-08-03",
      expenditure: 50,
      revenue: 250,
    },
    "2026-08-04": {
      date: "2026-08-04",
      expenditure: 100,
      revenue: 0,
    },
  });
});

test("category percentages use the selected transaction type", () => {
  assert.deepEqual(calcCategoryBreakdown(records), [
    { category_id: "food", percentage: 50, total: 75 },
    { category_id: "transport", percentage: 50, total: 75 },
  ]);
});
