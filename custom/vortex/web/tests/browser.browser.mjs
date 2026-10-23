// No screenshots, traces, video or raster fixtures. Desktop browser evidence only.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url),
  playwright = require("playwright");
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const selected = (
  process.env.VORTEX_BROWSER_PROJECTS || "chromium,firefox,webkit"
).split(",");
async function freePort() {
  const s = net.createServer();
  await new Promise((resolve) => s.listen(0, "127.0.0.1", resolve));
  const port = s.address().port;
  await new Promise((resolve) => s.close(resolve));
  return port;
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
for (const project of selected)
  test(
    `${project}: actual browser pairing, catalog, details, favorites, homebrew, settings, reconnect and responsive layouts`,
    { timeout: 120000 },
    async () => {
      const port = await freePort(),
        consoleFile = `${root}.vortex/browser-${project}-${port}.json`;
      const spawnServer = () =>
        spawn(
          process.execPath,
          [`${root}custom/vortex/web/backend/dev-server.mjs`],
          {
            env: {
              ...process.env,
              VORTEX_WEB_DEV_PORT: String(port),
              VORTEX_WEB_DEV_CONSOLE: consoleFile,
            },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
      let child = spawnServer(),
        browser;
      try {
        for (let i = 0; i < 100 && !existsSync(consoleFile); i++) {
          if (child.exitCode !== null)
            throw new Error("Development server exited");
          await wait(100);
        }
        assert.ok(existsSync(consoleFile), "Development console file is ready");
        const launch = { headless: true };
        if (project === "chromium" && process.env.VORTEX_CHROMIUM_EXECUTABLE)
          launch.executablePath = process.env.VORTEX_CHROMIUM_EXECUTABLE;
        browser = await playwright[project].launch(launch);
        const context = await browser.newContext({
            viewport: { width: 1440, height: 1000 },
          }),
          page = await context.newPage();
        await page.route("https://**/*", (route) => route.abort()); // no artwork downloads or external navigation
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${port}/`);
        await page.locator("#pair-dialog[open]").waitFor();
        const { code } = JSON.parse(readFileSync(consoleFile));
        try {
          await page.locator("#pair-code").fill(code);
        } catch {
          throw new Error("Pairing code input unavailable");
        }
        await page.locator("#device-name").fill(`${project} test browser`);
        await page.locator("#pair-form button").click();
        await page.locator("#pair-dialog").waitFor({ state: "hidden" });
        await page
          .getByRole("heading", { name: "Popular on Vortex" })
          .waitFor();
        const expected = await (
          await context.request.get(`http://127.0.0.1:${port}/api/v1/status`)
        ).json();
        assert.ok(
          (await page.locator(".stats").textContent()).includes(
            expected.counts.total.toLocaleString(),
          ),
        );
        await page.goto(`http://127.0.0.1:${port}/#catalog?platform=ps4`);
        await page
          .getByRole("heading", { name: "PlayStation 4", exact: true })
          .waitFor();
        await page.waitForFunction(
          (n) =>
            document
              .querySelector(".page-head")
              ?.textContent.includes(`${n} matching games`),
          expected.counts.ps4,
        );
        await page.locator(".card").first().click();
        await page.locator("#details-dialog[open] .detail-body").waitFor();
        await page.getByRole("button", { name: "♡ Add to favorites" }).click();
        await page
          .getByRole("button", { name: "♥ Saved to favorites" })
          .waitFor();
        await page.locator("#close-details").click();
        await page.goto(`http://127.0.0.1:${port}/#favorites`);
        await page.getByRole("heading", { name: "Your favorites" }).waitFor();
        assert.equal(await page.locator(".card").count(), 1);
        await page.goto(`http://127.0.0.1:${port}/#homebrew`);
        await page
          .getByRole("heading", { name: "Homebrew", exact: true })
          .waitFor();
        assert.match(
          await page.locator(".page-head").textContent(),
          /104 available apps/,
        );
        await page.goto(`http://127.0.0.1:${port}/#downloads`);
        await page
          .getByRole("heading", { name: "Downloads", exact: true })
          .waitFor();
        assert.match(
          await page.locator("main").textContent(),
          /Development transport/,
        );
        await page.goto(`http://127.0.0.1:${port}/#settings`);
        await page
          .getByRole("heading", { name: "Settings & devices" })
          .waitFor();
        assert.match(
          await page.locator("main").textContent(),
          new RegExp(`${project} test browser`),
        );
        for (const width of [768, 390]) {
          await page.setViewportSize({ width, height: 844 });
          await wait(100);
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            `No overflow at ${width}px`,
          );
        }
        // A stopped process is offline, not unpaired; persist the browser cookie across reload/restart.
        child.kill("SIGTERM");
        await new Promise((resolve) => child.once("exit", resolve));
        await page.locator("#notice-message").waitFor({ timeout: 35000 });
        assert.equal(
          await page.locator("#notice-message").textContent(),
          "Vortex is offline. Reopen Vortex on your PS5 to reconnect.",
        );
        assert.equal(await page.locator("#pair-dialog[open]").count(), 0);
        const credentials = await context.cookies();
        assert.ok(credentials.some((c) => c.name === "vortex_session"));
        child = spawnServer();
        for (let i = 0; i < 100 && !existsSync(consoleFile); i++)
          await wait(100);
        await page.locator("#reconnect").click();
        await page.waitForFunction(
          () =>
            document
              .querySelector("#connection")
              .textContent.includes("Connected"),
          null,
          { timeout: 35000 },
        );
        assert.equal(await page.locator("#pair-dialog[open]").count(), 0);
        // Ambiguous server failure during startup must retain authorization and avoid the pairing screen.
        for (const status of [503, 401]) {
          await page.route("**/api/v1/auth/session", (r) =>
            r.fulfill({
              status,
              contentType: "application/json",
              body: '{"error":"maintenance"}',
            }),
          );
          await page.reload();
          await page.locator("#notice-message").waitFor();
          assert.equal(await page.locator("#pair-dialog[open]").count(), 0);
          assert.ok(
            (await context.cookies()).some((c) => c.name === "vortex_session"),
          );
          await page.unroute("**/api/v1/auth/session");
          await page.locator("#reconnect").click();
          await page.waitForFunction(() =>
            document
              .querySelector("#connection")
              .textContent.includes("Connected"),
          );
        }
        await context.setOffline(true);
        await wait(3200);
        await context.setOffline(false);
        await page.reload();
        await page
          .getByRole("heading", { name: "Settings & devices" })
          .waitFor();
        await page.locator("#sign-out").click();
        await page.locator("#pair-dialog[open]").waitFor();
        assert.deepEqual(errors, []);
      } finally {
        if (browser) await browser.close();
        child.kill("SIGTERM");
        await new Promise((resolve) => {
          if (child.exitCode !== null) return resolve();
          child.once("exit", resolve);
        });
        rmSync(consoleFile, { force: true });
        rmSync(consoleFile + ".devices", { recursive: true, force: true });
      }
    },
  );
