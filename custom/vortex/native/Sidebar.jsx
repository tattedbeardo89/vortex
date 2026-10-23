import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { FocusScope, ScrollView, Text, View } from "@ps5-react/core";
import { Logo } from "../ui/Logo.jsx";
import { FocusRing } from "../ui/FocusRing.jsx";
import { colors } from "../ui/colors.js";
import { NO_FILTERS, genres, genreLabel } from "../state/catalog.js";
import { Menu, MenuItem, MenuDivider } from "../ui/Menu.jsx";
import { SIDEBAR } from "./navigation.js";
import { useStoreActions } from "../state/store.jsx";
import { VERSION } from "../version.js";
export function NativeSidebar({
  section,
  current,
  activate,
  filters,
  on,
  down,
  top,
  immersive,
  onLanguage,
  browsing,
  setBrowsing,
  onReturn,
}) {
  const { setQuery } = useStoreActions();
  const hidden = immersive || ["game", "search", "files"].includes(top.name);
  const item = (id, label, press, key) =>
    jsx(
      View,
      {
        focusKey:
          key ||
          (!hidden && id === current
            ? "nav:current"
            : id === "catalog"
              ? "nav:browse"
              : id === "settings"
                ? "nav:vortex-web"
                : `nav:${id}`),
        nextFocusRight: down,
        onPress: press,
        style: ({ focused }) => ({
          height: 58,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 18,
          borderRadius: 12,
          backgroundColor: focused
            ? colors.actionFocus
            : id === current
              ? colors.action
              : colors.surface,
        }),
        children: jsxs(View, {
          style: { flexDirection: "row", alignItems: "center", gap: 10 },
          children: [
            jsx(FocusRing, {}),
            jsx(Text, {
              style: {
                fontFamily: "Inter-Regular",
                fontSize: 24,
                color: colors.fg,
              },
              children: label,
            }),
          ],
        }),
      },
      id,
    );
  return jsxs(Fragment, {
    children: [
      hidden && !immersive
        ? jsx(View, {
            focusKey: "nav:current",
            onPress: () => {
              if (top.name === "search") setQuery("");
              onReturn();
            },
            nextFocusDown: down,
            style: {
              position: "absolute",
              left: 48,
              top: 24,
              height: 60,
              width: 360,
              zIndex: 40,
              justifyContent: "center",
              paddingHorizontal: 18,
              backgroundColor: colors.surface,
              borderRadius: 12,
            },
            children: jsx(Text, {
              style: {
                fontFamily: "Inter-Regular",
                fontSize: 24,
                color: colors.fg,
              },
              children: "‹ Back to Vortex",
            }),
          })
        : null,
      jsx(View, {
        style: {
          position: "absolute",
          left: 32,
          top: 32,
          bottom: 32,
          width: 272,
          zIndex: 40,
          backgroundColor: colors.surface,
          borderRadius: 18,
          display: hidden ? "none" : "flex",
        },
        children: jsx(FocusScope, {
          focusKey: "header",
          inert: hidden,
          children: jsxs(ScrollView, {
            style: { flex: 1, padding: 12, gap: 8 },
            children: [
              jsx(View, {
                style: { padding: 12, marginBottom: 12 },
                children: jsx(Logo, {}),
              }),
              ...SIDEBAR.map((row) =>
                item(row.id, row.label, () => activate(row.id)),
              ),
              item("search", "Search", on.search),
              item("top", "Top rated", on.top),
              item("files", "Files", on.files),
              item("genres", "Genres", () => setBrowsing(!browsing)),
              item("language", "Language & controls", onLanguage),
              jsx(Text, {
                style: {
                  fontFamily: "Inter-Regular",
                  fontSize: 18,
                  color: colors.muted,
                  marginTop: 8,
                },
                children: `Vortex ${VERSION} · L1 / R1 sections`,
              }),
            ],
          }),
        }),
      }),
      browsing && !hidden
        ? jsx(View, {
            style: {
              position: "absolute",
              left: 320,
              top: 32,
              width: 360,
              height: 0,
              zIndex: 55,
            },
            children: jsxs(Menu, {
              open: browsing,
              onClose: () => setBrowsing(false),
              rows: genres.length + 2,
              children: [
                jsx(MenuItem, {
                  label: "All Games",
                  autoFocus: !filters.genre.length,
                  onSelect: () =>
                    on.show(NO_FILTERS, "newest", undefined, "catalog"),
                }),
                jsx(MenuDivider, {}),
                ...genres.map((genre) =>
                  jsx(
                    MenuItem,
                    {
                      label: genreLabel(genre),
                      checked: filters.genre.includes(genre),
                      onSelect: () =>
                        on.show({ ...NO_FILTERS, genre: [genre] }, "newest"),
                    },
                    genre,
                  ),
                ),
              ],
            }),
          })
        : null,
    ],
  });
}
