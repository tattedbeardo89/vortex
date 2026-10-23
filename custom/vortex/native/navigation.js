// Native controller destinations use the original store/nav actions.
export const SIDEBAR = [
  { id: "discover", label: "Discover", focus: "spotlight:cta" },
  { id: "catalog", label: "All Games", focus: "catalog:sort" },
  { id: "ps5", label: "PlayStation 5", focus: "catalog:sort" },
  { id: "ps4", label: "PlayStation 4", focus: "catalog:sort" },
  { id: "homebrew", label: "Homebrew", focus: "homebrew-page" },
  { id: "favorites", label: "Favorites", focus: "catalog:sort" },
  { id: "downloads", label: "Downloads", focus: "screen" },
  { id: "settings", label: "Settings & Devices", focus: "web:toggle" },
];
export function destination(id, filters, actions, settings) {
  if (id === "settings") return settings();
  if (id === "ps5" || id === "ps4")
    return actions.show(
      { ...filters, platform: [id] },
      "newest",
      "catalog:sort",
      "catalog",
    );
  if (id === "catalog")
    return actions.show(filters, "newest", "catalog:sort", "catalog");
  return actions[id]();
}
export function currentSection(top, section, filters, settings = false) {
  if (settings) return "settings";
  if (
    top === "browse" &&
    section === "catalog" &&
    filters.platform?.length === 1 &&
    ["ps4", "ps5"].includes(filters.platform[0])
  )
    return filters.platform[0];
  return section;
}
export const CONTENT = {
  position: "absolute",
  left: 320,
  right: 32,
  top: 0,
  bottom: 32,
};
export const FULL = {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

// This is the only primary section order. Legacy destinations remain visible tools.
export function adjacentSection(current, forward) {
  const index = SIDEBAR.findIndex((row) => row.id === current);
  return SIDEBAR[
    (Math.max(0, index) + (forward ? 1 : SIDEBAR.length - 1)) % SIDEBAR.length
  ].id;
}
export function contentFocus(id) {
  return (
    SIDEBAR.find((row) => row.id === id)?.focus ||
    (id === "homebrew"
      ? "homebrew-page"
      : id === "downloads"
        ? "screen"
        : "page")
  );
}
