import { NO_FILTERS } from "../state/catalog.js";
import {
  useSettingsOpen,
  openWebSettings,
  closeWebSettings,
} from "../vortex-web/integration/WebPanel.jsx";
import {
  adjacentSection,
  contentFocus,
  currentSection,
  destination,
} from "./navigation.js";

export function useNativeNavigation({ top, section, filters, on, nav }) {
  const opened = useSettingsOpen();
  const current = currentSection(top.name, section, filters, opened);
  const activate = (id) => {
    if (id === "settings") {
      openWebSettings();
      return;
    }
    closeWebSettings();
    // Section changes replace the primary screen, rather than building a stack of tabs.
    if (["homebrew", "downloads"].includes(id) && top.name !== id) nav.home();
    destination(id, NO_FILTERS, on, openWebSettings);
    // Scope fallback resolves empty sections; stale card keys are not retained across unmounts.
    nav.focusLater(contentFocus(id));
  };
  return {
    current,
    opened,
    activate,
    step: (forward) => activate(adjacentSection(current, forward)),
    down: opened
      ? "web:controls"
      : top.name === "browse"
        ? "page"
        : top.name === "homebrew"
          ? "homebrew-page"
          : "screen",
  };
}
