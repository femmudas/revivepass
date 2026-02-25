import assert from "node:assert/strict";
import test from "node:test";
import { mergeSnapshotRows, parseManualAddressesInput } from "./snapshot.js";

const walletA = "8rN25w5ecRjT3hSLM2gFCQ8rLJiVn4A8L9jtrM7G7f1M";
const walletB = "7Fj6Y9n9cfrXMMQHzxkroYTsDWEvnM4Q4i6bY6QeJ8Hn";
const walletC = "6GyiM88RgPrXVvTEA1iNK8xZx67NwM7jW5cdD2hQvJjD";

test("parseManualAddressesInput handles multiline and json payloads", () => {
  const multiline = parseManualAddressesInput(`${walletA}\n${walletB},${walletC}`);
  assert.deepEqual(multiline, [walletA, walletB, walletC]);

  const jsonArray = parseManualAddressesInput(JSON.stringify([walletA, walletB]));
  assert.deepEqual(jsonArray, [walletA, walletB]);
});

test("mergeSnapshotRows deduplicates csv/manual wallets and reports invalid entries", () => {
  const csvRows = [
    { evm_address: "0x111", solana_wallet: walletA, amount: 1 },
    { evm_address: "0x222", solana_wallet: walletB, amount: 1 },
    { evm_address: "0x333", solana_wallet: walletB, amount: 2 },
  ];

  const merge = mergeSnapshotRows(
    csvRows,
    `${walletC}\n${walletB}\ninvalid-wallet\n${walletC}`
  );

  assert.equal(merge.rows.length, 3);
  assert.equal(merge.csvProvided, 3);
  assert.equal(merge.manualProvided, 4);
  assert.equal(merge.manualInserted, 1);
  assert.equal(merge.duplicatesIgnored, 3);
  assert.deepEqual(merge.invalidEntries, ["invalid-wallet"]);

  const insertedManual = merge.rows.find((row) => row.solana_wallet === walletC);
  assert.ok(insertedManual);
  assert.equal(insertedManual?.evm_address, "manual_entry");
  assert.equal(insertedManual?.amount, 1);
});
