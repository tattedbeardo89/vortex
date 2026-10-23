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
import { colors } from "../../ui/colors.js";
import { nativeState } from "./native-adapter.js";
import { refreshArtwork } from "./artwork.js";
import * as service from "./console-service.js";
let open = false;
const openListeners = new Set();
const show = (value) => {
  open = value;
  for (const listener of openListeners) listener(value);
};
export const openWebSettings = () => show(true);
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
      },
      children: value,
    });
  return jsx(View, {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: 90,
      backgroundColor: colors.canvas,
    },
    children: jsx(FocusScope, {
      trap: true,
      autoFocus: true,
      onAction: () => true,
      onBack: () => {
        show(false);
        return true;
      },
      children: jsx(ScrollView, {
        style: { padding: 60 },
        children: jsxs(View, {
          style: { gap: 20 },
          children: [
            text("Settings & Devices · Vortex Web", 42),
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
            jsx(Button2, {
              label: "Check durable storage",
              onPress: () => service.checkStorage(),
            }),
            Platform.OS === "ps5"
              ? jsx(Button2, {
                  label: "Refresh registered PS5 artwork (back up originals)",
                  onPress: () => {
                    try {
                      setArtworkMessage(
                        refreshArtwork(FileSystem, Platform.OS),
                      );
                    } catch (error) {
                      setArtworkMessage(error.message);
                    }
                  },
                })
              : null,
            artworkMessage ? text(artworkMessage, 20) : null,
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
            jsx(Button2, {
              label: info.enabled ? "Disable Vortex Web" : "Enable Vortex Web",
              onPress: () => change({ enabled: !info.enabled }),
            }),
            jsxs(View, {
              style: { flexDirection: "row", gap: 18 },
              children: [
                jsx(Button2, {
                  label: "Port −",
                  onPress: () =>
                    change({ port: Math.max(1024, info.port - 1) }),
                }),
                text(`Port ${info.port}`),
                jsx(Button2, {
                  label: "Port +",
                  onPress: () =>
                    change({ port: Math.min(65535, info.port + 1) }),
                }),
                jsx(Button2, {
                  label: "Reset port",
                  onPress: () => change({ port: 34189 }),
                }),
              ],
            }),
            jsx(Button2, {
              label:
                info.binding === "0.0.0.0"
                  ? "Binding: private LAN (change to loopback)"
                  : "Binding: loopback only (change to private LAN)",
              onPress: () =>
                change({
                  binding: info.binding === "0.0.0.0" ? "127.0.0.1" : "0.0.0.0",
                }),
            }),
            jsx(Button2, {
              label: info.readOnly ? "Read-only: on" : "Read-only: off",
              onPress: () => change({ readOnly: !info.readOnly }),
            }),
            info.running
              ? jsx(Button2, {
                  label: "Generate one-time pairing code",
                  onPress: () => {
                    try {
                      service.pairCode();
                    } catch {}
                  },
                })
              : null,
            info.pairing
              ? jsx(Button2, {
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
              ? jsx(Button2, {
                  label: "Reset all browser authorizations",
                  onPress: () => service.resetDevices(),
                })
              : null,
            jsx(Button2, { label: "Close", onPress: () => show(false) }),
          ],
        }),
      }),
    }),
  });
}
