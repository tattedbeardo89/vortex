const $ = (id) => document.getElementById(id);
const main = $("content"),
  pairDialog = $("pair-dialog"),
  detailsDialog = $("details-dialog");
let csrf = "",
  readOnly = false,
  sequence = 0,
  pollDelay = 2500,
  pollTimer = null,
  facets = null,
  currentDownloads = { items: [] },
  status = null;
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "disabled") node.disabled = Boolean(value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child !== null && child !== undefined)
      node.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
  }
  return node;
};
const bytes = (n) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "Unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1000 && i < 4) {
    n /= 1000;
    i++;
  }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
};
const picture = (url, alt, className = "") => {
  const img = el("img", { alt, loading: "lazy", class: className });
  try {
    const value = new URL(url);
    if (value.protocol === "https:") img.src = value.href;
  } catch {}
  img.addEventListener("error", () => img.remove());
  return img;
};
function notice(text) {
  $("notice").textContent = text;
  $("notice").hidden = !text;
}
function connection(connected, text) {
  $("connection").dataset.connected = String(connected);
  $("connection").textContent = text;
}
function requirePair(message = "") {
  csrf = "";
  facets = null;
  sequence++;
  if (detailsDialog.open) detailsDialog.close();
  connection(false, "Pairing required");
  $("pair-error").textContent = message;
  if (!pairDialog.open) pairDialog.showModal();
}
const OFFLINE = "Vortex is offline. Reopen Vortex on your PS5 to reconnect.";
function offline() {
  connection(false, OFFLINE);notice(OFFLINE);
  if (!csrf && !pairDialog.open) main.replaceChildren(el('div',{class:'empty',text:OFFLINE}));
}
async function api(path, body) {
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api/v1/${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers:
        body === undefined
          ? {}
          : { "Content-Type": "application/json", "X-Vortex-CSRF": csrf },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if(response.status>=500) { offline();throw new Error(OFFLINE); }
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && result.code === "PAIRING_REQUIRED" && !path.startsWith("auth/pair"))
        requirePair(result.error);
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    connection(
      true,
      readOnly ? "Connected · read-only" : "Connected to Vortex",
    );
    pollDelay = 2500;
    if($("notice").textContent===OFFLINE) notice("");
    return result;
  } catch (error) {
    if (error.name === "AbortError" || error instanceof TypeError) { offline();throw new Error(OFFLINE); }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
function heading(title, description = "") {
  return el(
    "div",
    { class: "page-head" },
    el(
      "div",
      {},
      el("h1", { text: title }),
      description ? el("p", { text: description }) : null,
    ),
  );
}
function empty(text) {
  return el("div", { class: "empty", text });
}
function gameCard(game) {
  return el(
    "button",
    {
      class: "card",
      "data-focus-key": game.id,
      "data-game-id": game.id,
      "aria-label": `${game.title} · ${game.homebrew ? "Homebrew" : game.platform.toUpperCase()}`,
      onclick: () => details(game.id),
    },
    el(
      "div",
      { class: "cover" },
      el("span", {
        class: "cover-fallback",
        "aria-hidden": "true",
        text: game.title.slice(0, 2).toUpperCase(),
      }),
      picture(game.cover, `${game.title} cover`),
      el("span", {
        class: "platform",
        text: game.homebrew ? "HOMEBREW" : game.platform.toUpperCase(),
      }),
    ),
    el("h3", { text: game.title }),
    el("small", {
      text:
        game.genres?.slice(0, 2).join(" · ") ||
        game.releaseDate?.slice(0, 4) ||
        "Vortex",
    }),
  );
}
function cards(items) {
  return items.length
    ? el("div", { class: "grid" }, items.map(gameCard))
    : empty("No matching items in Vortex.");
}
function section(title, items, href) {
  return el(
    "section",
    { class: "section" },
    el(
      "div",
      { class: "section-heading" },
      el("h2", { text: title }),
      href ? el("a", { href, text: "View all →" }) : null,
    ),
    cards(items),
  );
}
function replaceKeepingFocus(container, ...nodes) {
  const key = document.activeElement?.getAttribute("data-focus-key");
  container.replaceChildren(...nodes);
  if (key)
    [...container.querySelectorAll("[data-focus-key]")]
      .find((node) => node.getAttribute("data-focus-key") === key)
      ?.focus({ preventScroll: true });
}
function storagePanel(data) {
  return el(
    "section",
    { class: "panel" },
    el("h2", { text: "Storage" }),
    data.items.length
      ? data.items.map((root) =>
          el(
            "div",
            { class: "settings-row" },
            el(
              "div",
              {},
              el("strong", { text: root.label }),
              el("small", {
                text: `${bytes(root.free)} free · ${bytes(root.total)} total`,
              }),
            ),
          ),
        )
      : el("p", {
          class: "muted",
          text: "No storage destination reported by Vortex.",
        }),
  );
}
function downloadRow(job, commands = true) {
  const progress = el("progress", {
    "aria-label": `${job.title} progress`,
    max: "100",
  });
  if (job.total)
    progress.value = Math.max(
      0,
      Math.min(100, (job.written / job.total) * 100),
    );
  const content = el(
    "div",
    {},
    el("h3", { text: job.title }),
    el("small", { text: `${job.state} · ${job.destination || ""}` }),
    progress,
    el("small", {
      text: `${bytes(job.written)} / ${bytes(job.total)}${job.speed ? ` · ${bytes(job.speed)}/s` : ""}`,
    }),
    job.message ? el("small", { text: job.message }) : null,
    job.error ? el("small", { class: "error", text: job.error }) : null,
  );
  const labels = {
    pause: "Pause",
    resume: "Resume",
    cancel: "Cancel",
    openBrowser: "Verify on PS5",
    install: "Install PKG",
    register: "Register image",
  };
  const actions = commands
    ? el(
        "div",
        { class: "actions" },
        Object.entries(job.actions || {})
          .filter(([, available]) => available)
          .map(([action]) =>
            el("button", {
              text: labels[action],
              "data-focus-key": `${job.id}:${action}`,
              disabled: readOnly,
              onclick: async () => {
                if (
                  ["cancel", "install", "register"].includes(action) &&
                  !confirm(`${labels[action]} “${job.title}”?`)
                )
                  return;
                try {
                  await api("downloads/action", { id: job.id, action });
                  await loadPage();
                } catch (error) {
                  notice(error.message);
                }
              },
            }),
          ),
      )
    : null;
  return el("article", { class: "download" }, content, actions);
}
async function dashboard() {
  const [data, app] = await Promise.all([api("dashboard"), api("status")]);
  status = app;
  const featured = data.featured[0];
  const hero = featured
    ? el(
        "section",
        { class: "hero" },
        picture(featured.hero, featured.title),
        el(
          "div",
          { class: "hero-copy" },
          el("span", { class: "eyebrow", text: "FEATURED ON YOUR VORTEX" }),
          el("h1", { text: featured.title }),
          el("p", { text: featured.genres.join(" · ") }),
          el("button", {
            class: "primary",
            text: "Explore game",
            onclick: () => details(featured.id),
          }),
        ),
      )
    : null;
  const stat = (number, label) =>
    el(
      "div",
      { class: "stat" },
      el("strong", { text: Number(number).toLocaleString() }),
      el("small", { text: label }),
    );
  const jobs = data.downloads.items,
    completed = jobs.filter((j) =>
      [
        "downloaded",
        "file-downloaded",
        "installed",
        "installer-required",
        "extracted",
        "extraction-required",
      ].includes(j.state),
    );
  return [
    hero,
    el(
      "div",
      { class: "stats" },
      stat(app.counts.total, "Commercial games"),
      stat(app.counts.ps5, "PlayStation 5"),
      stat(app.counts.ps4, "PlayStation 4"),
    ),
    section("Popular on Vortex", data.popular, "#catalog?sort=relevance"),
    section("Latest releases", data.latestReleases, "#catalog?sort=newest"),
    el(
      "div",
      { class: "columns" },
      el(
        "section",
        { class: "panel" },
        el(
          "div",
          { class: "section-heading" },
          el("h2", { text: "Download activity" }),
          el("a", { href: "#downloads", text: "Manage →" }),
        ),
        jobs.filter((j) => !completed.includes(j)).length
          ? jobs
              .filter((j) => !completed.includes(j))
              .slice(0, 3)
              .map((j) => downloadRow(j, false))
          : el("p", { class: "muted", text: "Your download queue is quiet." }),
      ),
      storagePanel(data.storage),
    ),
    el(
      "section",
      { class: "section panel" },
      el("h2", { text: "Completed downloads" }),
      completed.length
        ? completed
            .slice(-5)
            .reverse()
            .map((j) => downloadRow(j, false))
        : el("p", {
            class: "muted",
            text: "Completed items in your Vortex queue will appear here.",
          }),
    ),
  ];
}
function selectControl(label, key, options, params, route) {
  const select = el(
    "select",
    { "aria-label": label },
    el("option", { value: "", text: "All" }),
    options.map((option) =>
      el("option", { value: option.value ?? option.id, text: option.name }),
    ),
  );
  select.value = params.get(key) || "";
  select.addEventListener("change", () => {
    const next = new URLSearchParams(params);
    if (select.value) next.set(key, select.value);
    else next.delete(key);
    next.delete("page");
    location.hash = `${route}?${next}`;
  });
  return el("label", {}, label, select);
}
function pagination(data, params, route) {
  const go = (page) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    location.hash = `${route}?${next}`;
  };
  return el(
    "div",
    { class: "pagination" },
    el("button", {
      text: "← Previous",
      disabled: data.page <= 1,
      onclick: () => go(data.page - 1),
    }),
    el("span", {
      class: "muted",
      text: `Page ${data.page} of ${Math.max(1, data.pages)}`,
    }),
    el("button", {
      text: "Next →",
      disabled: data.page >= data.pages,
      onclick: () => go(data.page + 1),
    }),
  );
}
async function catalogPage(params, homebrew = false) {
  if (!facets && !homebrew) facets = await api("facets");
  const route = homebrew ? "homebrew" : "catalog",
    data = await api(`${route}?${params}`);
  const title = homebrew
    ? "Homebrew"
    : params.get("platform") === "ps5"
      ? "PlayStation 5"
      : params.get("platform") === "ps4"
        ? "PlayStation 4"
        : "Your game library";
  const controls = homebrew
    ? [
        selectControl(
          "Category",
          "category",
          data.categories.map((value) => ({ value, name: value })),
          params,
          route,
        ),
      ]
    : [
        selectControl("Sort", "sort", facets.sorts, params, route),
        ...facets.facets.map((f) =>
          selectControl(f.name, f.key, f.options, params, route),
        ),
      ];
  return [
    heading(
      title,
      `${data.total.toLocaleString()} ${homebrew ? "available apps" : "matching games"}${params.get("q") ? ` · “${params.get("q")}”` : ""}`,
    ),
    el("div", { class: "filters" }, controls),
    cards(data.items),
    pagination(data, params, route),
  ];
}
async function settingsPage() {
  const [data, app] = await Promise.all([api("settings"), api("status")]);
  const row = (title, description, action) =>
    el(
      "div",
      { class: "settings-row" },
      el(
        "div",
        {},
        el("strong", { text: title }),
        el("small", { text: description }),
      ),
      action,
    );
  return [
    heading(
      "Settings & devices",
      "Remote access is controlled from Vortex on the PS5.",
    ),
    el(
      "section",
      { class: "panel" },
      row("Vortex Web", `API v${app.apiVersion} · Vortex ${app.version}`),
      row("Listening port", String(data.port)),
      row(
        "Binding",
        data.binding === "0.0.0.0"
          ? "Private LAN clients only"
          : "Loopback only",
      ),
      row("Read-only mode", data.readOnly ? "On" : "Off"),
      row(
        "Upstream baseline",
        `Upstream ${app.baseline.sourceVersion} · ${app.baseline.commit.slice(0, 12)}`,
      ),
      row("Catalog revision", app.baseline.catalogRevision),
      el("p", {
        class: "muted",
        text: "To change the port, binding, read-only mode or enable/disable access, open Web on the PS5. Changes revoke sessions. Vortex must remain open.",
      }),
    ),
    el(
      "section",
      { class: "section panel" },
      el("h2", { text: "Paired browsers" }),
      data.devices.map((device) =>
        row(
          device.name,
          `Expires ${new Date(device.expires).toLocaleTimeString()}${device.id === data.currentDevice ? " · this browser" : ""}`,
          el("button", {
            text: "Revoke",
            disabled: readOnly,
            onclick: async () => {
              if (!confirm(`Revoke ${device.name}?`)) return;
              try {
                await api("devices/revoke", { id: device.id });
                if (device.id === data.currentDevice)
                  requirePair("This browser was revoked.");
                else await loadPage();
              } catch (error) {
                notice(error.message);
              }
            },
          }),
        ),
      ),
    ),
  ];
}
async function loadPage() {
  if (!csrf) return;
  const ticket = ++sequence;
  notice("");
  const [route = "dashboard", query = ""] = location.hash.slice(1).split("?"),
    params = new URLSearchParams(query);
  $("search").value = params.get("q") || "";
  for (const anchor of document.querySelectorAll("#navigation a")) {
    if (
      anchor.hash === location.hash ||
      (route === "dashboard" && anchor.hash === "#dashboard")
    )
      anchor.setAttribute("aria-current", "page");
    else anchor.removeAttribute("aria-current");
  }
  main.classList.add("loading");
  try {
    let nodes;
    if (route === "catalog" || route === "homebrew")
      nodes = await catalogPage(params, route === "homebrew");
    else if (route === "favorites") {
      const data = await api("favorites");
      nodes = [
        heading(
          "Your favorites",
          `${data.items.length} saved items · shared with the PS5`,
        ),
        cards(data.items),
      ];
    } else if (route === "downloads") {
      currentDownloads = await api("downloads");
      nodes = [
        heading("Downloads", "The actual Vortex queue on your console."),
        currentDownloads.development
          ? el("p", {
              class: "notice",
              text: "Development transport: no console downloads or installations.",
            })
          : null,
        el(
          "section",
          { id: "download-list", class: "panel" },
          currentDownloads.items.length
            ? currentDownloads.items.map((j) => downloadRow(j))
            : el("p", {
                class: "muted",
                text: "No downloads in your Vortex queue.",
              }),
        ),
      ];
    } else if (route === "settings") nodes = await settingsPage();
    else nodes = await dashboard();
    if (ticket !== sequence) return;
    main.replaceChildren(...nodes.filter(Boolean));
  } catch (error) {
    if (ticket === sequence) {
      main.replaceChildren(
        empty(error.message),
        el("button", { text: "Try again", onclick: () => loadPage() }),
      );
      notice(error.message);
    }
  } finally {
    if (ticket === sequence) main.classList.remove("loading");
  }
}
async function details(id) {
  $("details-content").replaceChildren(empty("Loading game details…"));
  if (!detailsDialog.open) detailsDialog.showModal();
  try {
    const [game, storage] = await Promise.all([
      api(`game?id=${encodeURIComponent(id)}`),
      api("storage"),
    ]);
    if (!detailsDialog.open) return;
    const message = el("p", { role: "status" }),
      favorite = el("button", {
        text: game.wished ? "♥ Saved to favorites" : "♡ Add to favorites",
        disabled: readOnly,
        onclick: async () => {
          try {
            const wished = favorite.dataset.wished !== "true";
            await api("favorites", { id: game.id, wished });
            game.wished = wished;
            favorite.dataset.wished = String(game.wished);
            favorite.textContent = game.wished
              ? "♥ Saved to favorites"
              : "♡ Add to favorites";
          } catch (error) {
            message.textContent = error.message;
          }
        },
      });
    favorite.dataset.favoriteId = game.favoriteId;
    favorite.dataset.wished = String(game.wished);
    const edition = el(
        "select",
        { "aria-label": "Edition" },
        game.editions.map((e) =>
          el("option", {
            value: e.id,
            text: `${e.platform.toUpperCase()} · ${e.title}`,
          }),
        ),
      ),
      release = el("select", { "aria-label": "Release" }),
      destination = el(
        "select",
        { "aria-label": "Storage destination" },
        storage.items.map((root) =>
          el("option", {
            value: root.id,
            text: `${root.label} · ${bytes(root.free)} free`,
          }),
        ),
      );
    const start = el("button", {
      class: "primary",
      text: "Add to Vortex queue",
      disabled: readOnly,
      onclick: async () => {
        start.disabled = true;
        message.textContent = "";
        try {
          await api("downloads", {
            gameId: game.id,
            editionId: edition.value,
            releaseId: release.value,
            storageId: destination.value,
          });
          message.textContent =
            "Added to the PS5 queue. Provider verification may need the console.";
        } catch (error) {
          message.textContent = error.message;
        } finally {
          start.disabled = readOnly;
        }
      },
    });
    const update = () => {
      const current = game.editions.find((e) => e.id === edition.value);
      release.replaceChildren(
        ...current.releases.map((r) =>
          el("option", {
            value: r.id,
            text: `${r.provider || r.format} · ${r.label} · ${bytes(r.sizeBytes)}${r.unavailableReason ? " — unavailable" : ""}`,
            disabled: Boolean(r.unavailableReason),
          }),
        ),
      );
      start.disabled =
        readOnly ||
        !current.releases.some((r) => !r.unavailableReason) ||
        !storage.items.length;
    };
    edition.addEventListener("change", update);
    update();
    const label = (name, node) => el("label", {}, name, node);
    const body = el(
      "div",
      { class: "detail-body" },
      el("span", {
        class: "eyebrow",
        text: game.homebrew ? "HOMEBREW" : game.platform.toUpperCase(),
      }),
      el("h1", { text: game.title }),
      el("p", {
        text: [game.developer, game.releaseDate, game.genres.join(" · ")]
          .filter(Boolean)
          .join(" · "),
      }),
      el("div", { class: "actions" }, favorite),
      game.about.length
        ? game.about.slice(0, 12).map((text) => el("p", { text }))
        : el("p", {
            text: game.summary || "No description supplied by this catalog.",
          }),
      el("h2", { text: "Download options" }),
      el("p", {
        class: "muted",
        text: "These are the releases offered by Vortex. Listed sources are not a guarantee that remote files remain reachable.",
      }),
      el(
        "div",
        { class: "detail-controls" },
        label("Edition", edition),
        label("Release", release),
        label("Save to", destination),
        start,
      ),
      message,
      el(
        "div",
        { class: "shots" },
        game.shots
          .filter((x) => typeof x === "string")
          .slice(0, 8)
          .map((url) => picture(url, `${game.title} screenshot`)),
      ),
    );
    $("details-content").replaceChildren(
      picture(game.hero || game.cover, game.title, "detail-hero"),
      body,
    );
  } catch (error) {
    $("details-content").replaceChildren(empty(error.message));
  }
}
async function poll() {
  clearTimeout(pollTimer);
  if (!pairDialog.open && !document.hidden)
    try {
      if (!csrf) {
        const session=await api('auth/session');csrf=session.csrf;readOnly=session.readOnly;
        notice('');await loadPage();
      }
      currentDownloads = await api("downloads");
      $("queue-count").textContent =
        currentDownloads.items.filter((j) =>
          [
            "queued",
            "resolving",
            "connecting",
            "downloading",
            "verifying",
            "extracting",
            "installing",
          ].includes(j.state),
        ).length || "";
      if (detailsDialog.open) {
        const button = detailsDialog.querySelector("[data-favorite-id]");
        if (button) {
          const saved = await api("favorites");
          const wished = saved.items.some(
            (item) => item.id === button.dataset.favoriteId,
          );
          button.dataset.wished = String(wished);
          button.textContent = wished
            ? "♥ Saved to favorites"
            : "♡ Add to favorites";
        }
      }
      const list = $("download-list");
      if (list)
        replaceKeepingFocus(
          list,
          ...(currentDownloads.items.length
            ? currentDownloads.items.map((j) => downloadRow(j))
            : [
                el("p", {
                  class: "muted",
                  text: "No downloads in your Vortex queue.",
                }),
              ]),
        );
      if (location.hash.startsWith("#favorites")) {
        const data = await api("favorites");
        replaceKeepingFocus(
          main,
          heading(
            "Your favorites",
            `${data.items.length} saved items · shared with the PS5`,
          ),
          cards(data.items),
        );
      }
    } catch (error) {
      if(!pairDialog.open) offline();
      pollDelay = Math.min(30000, pollDelay * 2);
      notice(error.message);
    }
  pollTimer = setTimeout(poll, document.hidden ? 10000 : pollDelay);
}
$("pair-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  $("pair-error").textContent = "";
  try {
    const session = await api("auth/pair", {
      code: $("pair-code").value.trim(),
      name: $("device-name").value.trim(),
    });
    csrf = session.csrf;
    const checked = await api("auth/session");
    readOnly = checked.readOnly;
    pairDialog.close();
    $("pair-code").value = "";
    await loadPage();
    void poll();
  } catch (error) {
    $("pair-error").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
pairDialog.addEventListener("cancel", (event) => event.preventDefault());
$("close-details").addEventListener("click", () => detailsDialog.close());
$("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  location.hash = `catalog?q=${encodeURIComponent($("search").value.trim())}`;
});
$("sign-out").addEventListener("click", async () => {
  try {
    await api("auth/logout", {});
    requirePair();
  } catch(error) { notice(error.message); }
});
$("menu-toggle").addEventListener("click", () => {
  const open = $("navigation").classList.toggle("open");
  $("menu-toggle").setAttribute("aria-expanded", String(open));
});
window.addEventListener("hashchange", () => {
  $("navigation").classList.remove("open");
  $("menu-toggle").setAttribute("aria-expanded", "false");
  void loadPage();
});
window.addEventListener("online", () => {
  pollDelay = 2500;
  void poll();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void poll();
});
$("device-name").value = /iPhone|iPad/.test(navigator.userAgent)
  ? "My iPhone / iPad"
  : /Windows/.test(navigator.userAgent)
    ? "My Windows browser"
    : "My browser";
try {
  const session = await api("auth/session");
  csrf = session.csrf;
  readOnly = session.readOnly;
  await loadPage();
  void poll();
} catch (error) {
  if(!pairDialog.open) offline();
  void poll();
}

let lastActivitySent=0, activityPending=false;
async function userActivity(event) {
  if(activityPending || !event.isTrusted || !csrf || document.hidden || Date.now()-lastActivitySent<300000) return;
  activityPending=true;
  try { await api("auth/activity",{});lastActivitySent=Date.now(); } catch {} finally { activityPending=false; }
}
document.addEventListener("pointerdown",userActivity);
document.addEventListener("keydown",userActivity);
$("reconnect").addEventListener("click",()=>{pollDelay=2500;void poll();});

document.querySelector(".skip").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView({ block: "start" });
});
