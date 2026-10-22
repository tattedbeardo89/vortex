import { WebError } from "../security/auth.js";
export function queryOf(text = "") {
  const result = Object.create(null);
  for (const part of text.split("&").filter(Boolean)) {
    const [key, ...rest] = part.split("=");
    let name, value;
    try {
      name = decodeURIComponent(key.replace(/\+/g, " "));
      value = decodeURIComponent(rest.join("=").replace(/\+/g, " "));
    } catch {
      throw new WebError(400, "Invalid query encoding");
    }
    if (Object.hasOwn(result, name) || name.length > 40 || value.length > 300)
      throw new WebError(400, "Invalid query");
    result[name] = value;
  }
  return result;
}
const integer = (value, defaultValue, max) => {
  if (value === undefined) return defaultValue;
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > max)
    throw new WebError(400, "Invalid page size or page");
  return Number(value);
};
const card = (g) => ({
  id: g.id,
  title: g.title,
  platform: g.platform,
  genres: g.genres,
  releaseDate: g.releaseDate,
  cover: g.art?.cover || null,
  hero: g.art?.hero || null,
  homebrew: Boolean(g.homebrew),
  sizeGb: g.sizeGb,
});
const redact = (value) =>
  String(value || "")
    .replace(/https?:\/\/\S+/g, "[provider address]")
    .slice(0, 500);
export function createStateAdapter({
  catalog,
  homebrew,
  queue,
  roots,
  usage,
  driveName,
  wishlist,
  setFavorite,
  featured = () => [],
  charts = () => [],
  version,
  baseline,
  development = false,
}) {
  const pagination = (rows, q) => {
    const page = integer(q.page, 1, 10000),
      limit = integer(q.limit, 24, 60);
    return {
      items: rows.slice((page - 1) * limit, page * limit).map(card),
      page,
      limit,
      total: rows.length,
      pages: Math.ceil(rows.length / limit),
    };
  };
  const game = (id) => {
    if (typeof id !== "string" || id.length > 90)
      throw new WebError(400, "Invalid game id");
    const value = catalog.getGame(id);
    if (!value) throw new WebError(404, "Game is unavailable in this catalog");
    return value;
  };
  const filters = (q) => {
    const result = { ...catalog.NO_FILTERS };
    for (const facet of catalog.FACETS) {
      const picked = q[facet.key] ? q[facet.key].split(",") : [];
      if (
        picked.length > 8 ||
        picked.some(
          (value) => !facet.options.some((option) => option.value === value),
        )
      )
        throw new WebError(400, `Invalid ${facet.key} filter`);
      result[facet.key] = picked;
    }
    result.wishlist = q.favorites === "1";
    return result;
  };
  const catalogRows = (q) => {
    const sort = q.sort || "newest";
    if (!catalog.SORTS.some((x) => x.id === sort))
      throw new WebError(400, "Invalid sort");
    return catalog.sortGames(
      catalog.filterGames({
        filters: filters(q),
        query: q.q || "",
        wishlist: wishlist(),
      }),
      sort,
    );
  };
  const all = () =>
    catalog.filterGames({
      filters: catalog.NO_FILTERS,
      query: "",
      wishlist: wishlist(),
    });
  const rootIds = new Map();
  const idFor = (root) => {
    if (!rootIds.has(root)) rootIds.set(root, `storage-${rootIds.size}`);
    return rootIds.get(root);
  };
  const storage = () => ({
    items: roots().map((root) => {
      let bytes = { total: null, free: null };
      try {
        bytes = usage(root);
      } catch {}
      return {
        id: idFor(root),
        label: driveName(root),
        total: bytes.total,
        free: bytes.free,
      };
    }),
  });
  const actions = (job) => ({
    pause: [
      "queued",
      "resolving",
      "connecting",
      "downloading",
      "verifying",
      "extracting",
    ].includes(job.state),
    resume: ["paused", "failed"].includes(job.state),
    cancel: ![
      "downloaded",
      "file-downloaded",
      "installer-required",
      "installed",
      "extracted",
      "extraction-required",
      "removing",
    ].includes(job.state),
    openBrowser: job.state === "awaiting-browser",
    install: job.state === "installer-required" && Boolean(queue().installs),
    register: job.state === "downloaded",
  });
  const downloads = () => ({
    items: queue()
      .snapshot()
      .map((job) => ({
        id: job.id,
        gameId: job.gameId,
        title: job.title,
        state: job.state,
        written: job.written || 0,
        total: job.total || null,
        speed: job.bytesPerSecond || job.speed || 0,
        message: redact(job.message),
        error: redact(job.error),
        destination: driveName(job.root),
        actions: actions(job),
      })),
    development,
  });
  return {
    async status() {
      const rows = all();
      return {
        apiVersion: 1,
        name: "Vortex",
        version,
        baseline,
        development,
        counts: {
          total: rows.length,
          ps5: rows.filter((g) => g.platform === "ps5").length,
          ps4: rows.filter((g) => g.platform === "ps4").length,
        },
        homebrew: homebrew.homebrewApps().length,
      };
    },
    facets() {
      return {
        facets: catalog.FACETS.map((f) => ({
          key: f.key,
          name: catalog.facetTitle(f.key),
          options: f.options.map((o) => ({
            value: o.value,
            name: catalog.optionLabel(o),
          })),
        })),
        sorts: catalog.SORTS.map((x) => ({
          id: x.id,
          name: catalog.sortLabel(x.id),
        })),
      };
    },
    async dashboard() {
      const rows = all();
      return {
        featured: featured().map(card),
        latestReleases: catalog
          .sortGames(rows, "newest")
          .slice(0, 12)
          .map(card),
        recentlyAddedSupported: false,
        popular:
          charts()
            .find((x) => x.id === "relevance")
            ?.games.map(card) ||
          catalog.sortGames(rows, "relevance").slice(0, 12).map(card),
        downloads: downloads(),
        storage: storage(),
      };
    },
    catalog(text) {
      const q = queryOf(text);
      return pagination(catalogRows(q), q);
    },
    async homebrew(text) {
      await homebrew.refresh();
      const q = queryOf(text);
      let rows = homebrew.homebrewApps();
      if (q.q)
        rows = rows.filter((g) =>
          g.title.toLowerCase().includes(q.q.toLowerCase()),
        );
      if (q.category)
        rows = rows.filter((g) => g.homebrew.category === q.category);
      return {
        ...pagination(rows, q),
        categories: [
          ...new Set(homebrew.homebrewApps().map((g) => g.homebrew.category)),
        ],
      };
    },
    async details(text) {
      const q = queryOf(text);
      let g = game(q.id);
      if (g.homebrew) {
        await homebrew.loadDetails(g);
        g = game(q.id);
      }
      return {
        ...card(g),
        developer: g.developer,
        publisher: g.publisher,
        about: g.about || [],
        summary: g.shortDescription || "",
        shots: g.shots || [],
        favoriteId: catalog.listedId(g.id),
        wished: wishlist().includes(catalog.listedId(g.id)),
        editions: catalog.editionsOf(g).map((e) => ({
          ...card(e),
          releases: e.releases.map((r) => ({
            id: r.id,
            label: r.label || r.filename,
            provider: r.provider || "",
            format: r.format,
            filename: r.filename,
            sizeBytes: r.sizeBytes || null,
            unavailableReason: r.unavailableReason || null,
            requiresConsoleBrowser: Boolean(r.browserUrl),
          })),
        })),
      };
    },
    favorites() {
      return {
        items: wishlist()
          .map((id) => catalog.getGame(id))
          .filter(Boolean)
          .map(card),
      };
    },
    favorite(body) {
      const g = game(body.id);
      if (typeof body.wished !== "boolean")
        throw new WebError(400, "Favorite state must be boolean");
      setFavorite(catalog.listedId(g.id), body.wished);
      return { ok: true };
    },
    downloads,
    storage,
    async enqueue(body, authorize = () => {}) {
      const primary = game(body.gameId);
      const edition = catalog
        .editionsOf(primary)
        .find((e) => e.id === (body.editionId || primary.id));
      if (!edition)
        throw new WebError(400, "Edition does not belong to this game");
      if (edition.homebrew) await homebrew.loadDetails(edition);
      const release = edition.releases.find((r) => r.id === body.releaseId);
      if (!release || release.unavailableReason)
        throw new WebError(400, "Release is unavailable");
      const root = roots().find((value) => idFor(value) === body.storageId);
      if (!root)
        throw new WebError(
          400,
          "Choose a listed, connected storage destination",
        );
      if (development)
        throw new WebError(
          409,
          "Development transport does not download or install files",
        );
      authorize();
      return { id: queue().enqueue(edition, release, root) };
    },
    async command(body) {
      if (development)
        throw new WebError(
          409,
          "Development transport cannot control console downloads",
        );
      if (typeof body.id !== "string" || body.id.length > 300)
        throw new WebError(400, "Invalid job id");
      const job = queue()
        .snapshot()
        .find((j) => j.id === body.id);
      if (!job) throw new WebError(404, "Download not found");
      if (
        typeof body.action !== "string" ||
        !Object.hasOwn(actions(job), body.action) ||
        actions(job)[body.action] !== true
      )
        throw new WebError(
          409,
          "This action is unavailable in the current queue state",
        );
      await queue()[body.action](job.id);
      return { ok: true };
    },
  };
}
