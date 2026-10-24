import { defineConfig } from "../../node_modules/@playwright/test/index.mjs";
export default defineConfig({
  testDir: "./tests",
  tsconfig: "../../tsconfig.json",
  testMatch: "ioBalance.spec.ts",
  timeout: 120000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: "list",
  use: {
    actionTimeout: 15000,
    baseURL: process.env.CARE_IO_URL ?? "http://127.0.0.1:4011",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
