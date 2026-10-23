import "../../assets/Inter-Regular.ttf";
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import {
  FocusScope,
  ScrollView,
  Text,
  View,
  FileSystem,
  Platform,
} from "@ps5-react/core";
import { useWishlist, useStoreActions } from "../../state/store.jsx";
import { NavItem } from "../../ui/NavItem.jsx";
import { Button2 } from "../../ui/Button.jsx";
import { useNavActions } from "../../state/nav.jsx";
import { colors } from "../../ui/colors.js";
import { nativeState } from "./native-adapter.js";
import { refreshArtwork, inspectArtwork, restoreArtwork } from "./artwork.js";
import * as service from "./console-service.js";
let open = false;
const openListeners = new Set();
const show = (value) => {
  open = value;
  for (const listener of openListeners) listener(value);
};
export const openWebSettings = () => show(true);
export const closeWebSettings = () => show(false);
export function useSettingsOpen() {
  const [opened, setOpened] = useState(open);
  useEffect(() => {
    openListeners.add(setOpened);
    return () => openListeners.delete(setOpened);
  }, []);
  return opened;
}
// Explicit left exit from every settings control, including the last scrolled row.
function SettingsButton(props) {
  return jsx(Button2, { nextFocusLeft: "nav:current", ...props });
}
export function WebControl() {
  return jsx(NavItem, {
    focusKey: "nav:vortex-web",
    label: "Web",
    icon: "globe",
    onPress: () => show(true),
  });
}
export function WebPanel() {
  const wishlist = useWishlist(),
    actions = useStoreActions();
  const wish = useRef(wishlist);
  wish.current = wishlist;
  const nav = useNavActions();
  const [artworkInfo, setArtworkInfo] = useState(null);
  const [artworkConfirm, setArtworkConfirm] = useState(false);
  const [artworkMessage, setArtworkMessage] = useState("");
  const [opened, setOpened] = useState(open),
    [info, setInfo] = useState(service.snapshot());
  useEffect(() => {
    openListeners.add(setOpened);
    return () => openListeners.delete(setOpened);
  }, []);
  useEffect(() => {
    const off = service.subscribe(() => setInfo(service.snapshot()));
    const stop = service.startService(
      nativeState({
        wishlist: () => wish.current,
        setFavorite: actions.webSetWish,
      }),
    );
    return () => {
      off();
      stop();
    };
  }, []);
  useEffect(() => {
    if (!opened) return;
    const id = setInterval(() => setInfo(service.snapshot()), 1000);
    return () => clearInterval(id);
  }, [opened]);
  useEffect(() => {
    if (opened && info.pairing) nav.focusLater("web:pair-code");
  }, [opened, info.pairing?.code]);
  if (!opened) return null;
  const change = (values) => {
    try {
      service.apply({ ...info, ...values });
    } catch {}
    setInfo(service.snapshot());
  };
  const text = (value, size = 24, color = colors.fg) =>
    jsx(Text, {
      style: {
        fontFamily: "Inter-Regular",
        fontSize: size,
        color,
        lineHeight: size + 10,
        flexShrink: 0,
      },
      children: value,
    });
  return jsx(View, {
    style: {
      position: "absolute",
      left: 320,
      right: 32,
      top: 32,
      bottom: 32,
      zIndex: 90,
      backgroundColor: colors.canvas,
    },
    children: jsx(FocusScope, {
      focusKey: "web:controls",
      autoFocus: true,
      onAction: (action) => action !== "l1" && action !== "r1",
      onBack: () => {
        show(false);
        return true;
      },
      children: jsx(ScrollView, {
        style: { flex: 1, overflow: "hidden", padding: 32 },
        children: jsxs(View, {
          style: { gap: 20, flexShrink: 0, paddingBottom: 32 },
          children: [
            text("Settings & Devices · Vortex Web", 42),
            text(
              info.running
                ? "Local browser access is running"
                : "Browser access is disabled",
              26,
              info.running ? colors.ok : colors.muted,
            ),
            text(
              `Open http://<PS5 LAN IP>:${info.port} on the same network. Find the IP in PS5 Settings → Network → Connection Status. Keep Vortex open.`,
              22,
              colors.muted,
            ),
            info.error ? text(info.error, 22, colors.error) : null,
            jsx(SettingsButton, {
              focusKey: "web:toggle",
              nextFocusUp: "web:toggle",
              label: info.enabled ? "Disable Vortex Web" : "Enable Vortex Web",
              onPress: () => change({ enabled: !info.enabled }),
            }),
            info.running
              ? jsx(SettingsButton, {
                  focusKey: "web:generate",
                  label: "Generate one-time pairing code",
                  onPress: () => {
                    try {
                      service.pairCode();
                    } catch {}
                  },
                })
              : null,
            info.pairing
              ? jsx(SettingsButton, {
                  focusKey: "web:pair-code",
                  label: `Pairing code: ${info.pairing.code} (${Math.max(0, Math.ceil((info.pairing.expires - Date.now()) / 1000))}s)`,
                  onPress: () => service.pairCode(),
                })
              : text(
                  "No active pairing code. Paired browsers remain authorized for 30 days after their last activity.",
                  22,
                  colors.muted,
                ),
            text(`Paired browsers: ${info.devices.length}`, 26),
            ...info.devices.map((device) =>
              jsx(
                Button2,
                {
                  focusKey: `web:revoke:${device.id}`,
                  label: `Revoke ${device.name}`,
                  onPress: () => service.revoke(device.id),
                },
                device.id,
              ),
            ),
            text(
              "Restarting the listener keeps paired devices. Background polling does not extend authorization. HTTP is for trusted local networks only.",
              20,
              colors.muted,
            ),
            info.error
              ? jsx(SettingsButton, {
                  label: "Reset all browser authorizations",
                  onPress: () => service.resetDevices(),
                })
              : null,
            text("Connection options", 30),
            jsxs(View, {
              style: { flexDirection: "row", gap: 18 },
              children: [
                jsx(SettingsButton, {
                  focusKey: "web:port-minus",
                  label: "Port −",
                  onPress: () =>
                    change({ port: Math.max(1024, info.port - 1) }),
                }),
                text(`Port ${info.port}`),
                jsx(SettingsButton, {
                  focusKey: "web:port-plus",
                  label: "Port +",
                  onPress: () =>
                    change({ port: Math.min(65535, info.port + 1) }),
                }),
                jsx(SettingsButton, {
                  focusKey: "web:port-reset",
                  label: "Reset port",
                  onPress: () => change({ port: 34189 }),
                }),
              ],
            }),
            jsx(SettingsButton, {
              focusKey: "web:binding",
              label:
                info.binding === "0.0.0.0"
                  ? "Binding: private LAN (change to loopback)"
                  : "Binding: loopback only (change to private LAN)",
              onPress: () =>
                change({
                  binding: info.binding === "0.0.0.0" ? "127.0.0.1" : "0.0.0.0",
                }),
            }),
            jsx(SettingsButton, {
              focusKey: "web:read-only",
              label: info.readOnly ? "Read-only: on" : "Read-only: off",
              onPress: () => change({ readOnly: !info.readOnly }),
            }),
            text("Build, storage & artwork diagnostics", 30),
            text(`Vortex ${info.build?.version} · ${info.build?.commit}`, 20),
            text(
              `Mounted assets: ${info.build?.mountedAssetsMatch ? "match compiled application" : "MISMATCH"} · ${info.build?.mountedBuildCommit}`,
              20,
            ),
            text(
              `Build ${info.build?.buildDate} (${info.build?.dateBasis})`,
              20,
            ),
            text(
              `Upstream ${info.build?.upstream?.version} · ${info.build?.upstream?.commit}`,
              20,
            ),
            text(
              `Web ${info.build?.webFrontendId} · API ${info.build?.apiVersion} · pairing schema ${info.build?.pairingSchema}`,
              18,
            ),
            text(`Branding ${info.build?.brandingRevision}`, 18),
            text(
              `Durable storage: ${info.storage?.writable ? "read/write probe passed" : "unavailable"} · ${info.storage?.directory}`,
              20,
            ),
            text(
              "A write/read probe does not prove survival across PS5 reboot. Compare the build commit above with the downloaded image.",
              20,
              colors.muted,
            ),
            jsx(SettingsButton, {
              focusKey: "web:storage",
              label: "Check durable storage",
              onPress: () => service.checkStorage(),
            }),
            jsx(SettingsButton, {
              focusKey: "web:artwork-check",
              label: "Inspect mounted and registered artwork (read-only)",
              onPress: () => setArtworkInfo(inspectArtwork(FileSystem)),
            }),
            artworkInfo
              ? jsxs(View, {
                  style: { gap: 12 },
                  children: [
                    text(
                      `Compiled artwork: ${artworkInfo.compiledRevision}`,
                      18,
                    ),
                    text(
                      `Mounted artwork revision: ${artworkInfo.mountedRevision || "unavailable"}`,
                      18,
                    ),
                    text(`Registered path: ${artworkInfo.registeredPath}`, 18),
                    ...Object.entries(artworkInfo.files).map(([name, file]) =>
                      jsxs(
                        View,
                        {
                          style: { gap: 6 },
                          children: [
                            text(name, 22),
                            text(
                              `Expected: ${file.expected || "unavailable"}`,
                              18,
                            ),
                            text(
                              `Mounted: ${file.mounted || "unavailable"}`,
                              18,
                            ),
                            text(
                              `Appmeta: ${file.registered || "unavailable"}`,
                              18,
                            ),
                            text(
                              `Staged sce_sys: ${file.staged || "unavailable"}`,
                              18,
                            ),
                            name === "icon0.png"
                              ? text(
                                  `Staged root icon: ${file.stagedIcon || "unavailable"}`,
                                  18,
                                )
                              : null,
                          ],
                        },
                        name,
                      ),
                    ),
                    text(
                      "The PS5 shell's in-memory artwork cache cannot be verified by this check.",
                      18,
                      colors.muted,
                    ),
                  ],
                })
              : null,
            Platform.OS === "ps5" && artworkInfo
              ? jsx(SettingsButton, {
                  label: artworkConfirm
                    ? "Confirm Vortex-only artwork refresh and backup"
                    : "Refresh registered PS5 artwork (back up originals)",
                  onPress: () => {
                    if (!artworkConfirm) {
                      setArtworkConfirm(true);
                      return;
                    }
                    try {
                      setArtworkMessage(
                        refreshArtwork(FileSystem, Platform.OS),
                      );
                    } catch (error) {
                      setArtworkMessage(error.message);
                    }
                    setArtworkConfirm(false);
                  },
                })
              : null,
            Platform.OS === "ps5" && artworkInfo
              ? jsx(SettingsButton, {
                  label: "Restore backed-up Vortex artwork",
                  onPress: () => {
                    try {
                      setArtworkMessage(
                        restoreArtwork(FileSystem, Platform.OS),
                      );
                    } catch (error) {
                      setArtworkMessage(error.message);
                    }
                  },
                })
              : null,
            artworkMessage ? text(artworkMessage, 20) : null,
            jsx(SettingsButton, {
              focusKey: "web:close",
              nextFocusDown: "web:close",
              label: "Close",
              onPress: () => show(false),
            }),
          ],
        }),
      }),
    }),
  });
}
