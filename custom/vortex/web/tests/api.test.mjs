import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { createStateAdapter, queryOf } from "../integration/state-adapter.js";
const root = fileURLToPath(new URL("../../../../", import.meta.url));
process.env.CATALOG_APP_ROOT = `${root}.vortex/vortex`;
process.env.CATALOG_REACT_PATH = `${root}ps5-react/node_modules/react/index.js`;
process.env.CATALOG_HOMEBREW_FILE = `${root}custom/vortex/tests/fixtures/homebrew-index.json`;
register(
  pathToFileURL(`${root}tools/catalog-diagnostics/loader.mjs`),
  import.meta.url,
);
const catalog = await import(
  pathToFileURL(`${root}.vortex/vortex/state/catalog.js`)
);
const hb = await import(
  pathToFileURL(`${root}.vortex/vortex/state/homebrew.js`)
);
const baseline = JSON.parse(
  readFileSync(`${root}custom/vortex/upstream-baseline.json`),
);
let favorites = [],
  calls = [],
  jobs = [];
const queue = {
  snapshot: () => jobs,
  enqueue: (...args) => {
    calls.push(args);
    return "actual-engine-id";
  },
  pause: (id) => calls.push(["pause", id]),
  resume: (id) => calls.push(["resume", id]),
  cancel: (id) => calls.push(["cancel", id]),
};
const state = createStateAdapter({
  catalog,
  homebrew: { ...hb, refresh: async () => {}, loadDetails: async () => {} },
  queue: () => queue,
  roots: () => ["/data"],
  usage: () => ({ total: 1000, free: 500 }),
  driveName: () => "Internal storage",
  wishlist: () => favorites,
  setFavorite: (id, wished) => {
    favorites = wished
      ? [...new Set([...favorites, id])]
      : favorites.filter((x) => x !== id);
  },
  version: "test",
  baseline,
});
test("real catalog parity, pagination, platform filters and sorts use upstream modules", async () => {
  const s = await state.status();
  const reference = catalog.filterGames({
    filters: catalog.NO_FILTERS,
    query: "",
    wishlist: [],
  });
  assert.deepEqual(s.counts, {
    total: reference.length,
    ps5: reference.filter((g) => g.platform === "ps5").length,
    ps4: reference.filter((g) => g.platform === "ps4").length,
  });
  if (baseline.commit === "9f90d882771eb87f75579b10f951cc2dbe4daf2a")
    assert.deepEqual(s.counts, { total: 1148, ps5: 1009, ps4: 139 });
  assert.equal(state.catalog("platform=ps5").total, s.counts.ps5);
  assert.equal(state.catalog("platform=ps4").total, s.counts.ps4);
  const first = state.catalog("limit=60&sort=title"),
    second = state.catalog("page=2&limit=60&sort=title");
  assert.equal(first.items.length, 60);
  assert.equal(
    new Set([...first.items, ...second.items].map((x) => x.id)).size,
    120,
  );
  assert.equal(state.catalog("q=definitely-no-matching-game").total, 0);
  const expected = catalog
    .sortGames(
      catalog.filterGames({
        filters: catalog.NO_FILTERS,
        query: "",
        wishlist: [],
      }),
      "title",
    )
    .slice(0, 60)
    .map((g) => g.id);
  assert.deepEqual(
    first.items.map((g) => g.id),
    expected,
  );
});
test("query validation, hidden games and unsupported provider filters are rejected", () => {
  for (const q of [
    "page=0",
    "limit=61",
    "sort=unknown",
    "platform=ps3",
    "provider=mediafire",
  ])
    assert.throws(() => state.catalog(q));
  assert.throws(() => queryOf("q=a&q=b"));
  assert.throws(() => queryOf("q=%zz"));
  assert.throws(() => state.favorite({ id: "CUSA99999", wished: true }));
});
test("real homebrew snapshot exposes 104 available apps, excluding coming-soon records", async () => {
  const data = await state.homebrew("limit=60");
  assert.equal(data.total, 104);
  assert.equal(data.items.length, 60);
  assert.equal((await state.homebrew("q=not-an-app-name")).total, 0);
});
test("favorites reflect the shared adapter and explicit boolean changes are idempotent", () => {
  const id = state.catalog("").items[0].id;
  state.favorite({ id, wished: true });
  state.favorite({ id, wished: true });
  assert.equal(state.favorites().items.length, 1);
  state.favorite({ id, wished: false });
  assert.equal(state.favorites().items.length, 0);
  assert.throws(() => state.favorite({ id, wished: "yes" }));
});
test("download requests use only existing releases/storage and dispatch to the existing queue", async () => {
  calls = [];
  const item = catalog
    .filterGames({ filters: catalog.NO_FILTERS, query: "", wishlist: [] })
    .find(
      (g) => g.releases.length && g.releases.some((r) => !r.unavailableReason),
    );
  const release = item.releases.find((r) => !r.unavailableReason);
  await assert.rejects(() =>
    state.enqueue({
      gameId: item.id,
      releaseId: "injected-source",
      storageId: "storage-0",
    }),
  );
  await assert.rejects(() =>
    state.enqueue({
      gameId: item.id,
      releaseId: release.id,
      storageId: "/data",
    }),
  );
  await assert.rejects(() =>
    state.enqueue({
      gameId: item.id,
      editionId: "CUSA99999",
      releaseId: release.id,
      storageId: "storage-0",
    }),
  );
  const result = await state.enqueue({
    gameId: item.id,
    releaseId: release.id,
    storageId: "storage-0",
  });
  assert.equal(result.id, "actual-engine-id");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], item);
  assert.equal(calls[0][1], release);
  assert.equal(calls[0][2], "/data");
});
test("queue snapshots, progress and state-gated actions are real adapter values", async () => {
  calls = [];
  jobs = [
    {
      id: "job-1",
      gameId: "PPSA01500",
      title: "Queued game",
      state: "downloading",
      written: 123,
      total: 999,
      bytesPerSecond: 42,
      root: "/data",
      release: { url: "secret" },
    },
  ];
  const view = state.downloads().items[0];
  assert.equal(view.written, 123);
  assert.equal(view.speed, 42);
  assert.equal(view.release, undefined);
  await state.command({ id: "job-1", action: "pause" });
  assert.deepEqual(calls, [["pause", "job-1"]]);
  await assert.rejects(() => state.command({ id: "job-1", action: "resume" }));
  await assert.rejects(() =>
    state.command({ id: "job-1", action: "deleteFromDisk" }),
  );
  await assert.rejects(() =>
    state.command({ id: "job-1", action: "constructor" }),
  );
  assert.deepEqual(state.storage(), {
    items: [
      { id: "storage-0", label: "Internal storage", total: 1000, free: 500 },
    ],
  });
});
test("storage IDs survive drive reorder and reject disconnected destinations", async () => {
  let connected = ["/first", "/second"];
  const adapter = createStateAdapter({
    catalog,
    homebrew: hb,
    queue: () => queue,
    roots: () => connected,
    usage: () => ({}),
    driveName: (r) => r,
    wishlist: () => [],
    setFavorite: () => {},
    version: "test",
    baseline,
  });
  const original = adapter.storage().items;
  connected.reverse();
  assert.equal(adapter.storage().items[1].id, original[0].id);
  connected = ["/second"];
  const item = catalog
    .filterGames({ filters: catalog.NO_FILTERS, query: "", wishlist: [] })
    .find((g) => g.releases.some((r) => !r.unavailableReason));
  await assert.rejects(
    () =>
      adapter.enqueue({
        gameId: item.id,
        releaseId: item.releases.find((r) => !r.unavailableReason).id,
        storageId: original[0].id,
      }),
    /connected storage/,
  );
});
