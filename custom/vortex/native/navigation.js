// Native controller destinations use the original store/nav actions.
export const SIDEBAR = [
  { id: "discover", label: "Discover" },
  { id: "catalog", label: "All Games" },
  { id: "ps5", label: "PlayStation 5" },
  { id: "ps4", label: "PlayStation 4" },
  { id: "homebrew", label: "Homebrew" },
  { id: "favorites", label: "Favorites" },
  { id: "downloads", label: "Downloads" },
  { id: "settings", label: "Settings & Devices" },
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
export function currentSection(top, section, filters) {
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
