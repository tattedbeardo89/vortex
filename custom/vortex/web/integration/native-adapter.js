import * as catalog from "../../state/catalog.js";
import * as homebrew from "../../state/homebrew.js";
import {
  downloadQueue,
  storageRoots,
  driveName,
} from "../../state/downloads.js";
import { FileSystem } from "@ps5-react/core";
import { webFeatured } from "../../browse/Spotlight.jsx";
import { webCharts } from "../../browse/TopCharts.jsx";
import { BRAND } from "../../vortex-brand.js";
import { BASELINE } from "../../vortex-baseline.js";
import { createStateAdapter } from "./state-adapter.js";
export function nativeState({ wishlist, setFavorite }) {
  return createStateAdapter({
    catalog,
    homebrew,
    queue: downloadQueue,
    roots: storageRoots,
    usage: (root) => FileSystem.diskUsage(root),
    driveName,
    wishlist,
    setFavorite,
    featured: () => webFeatured,
    charts: () => webCharts,
    version: BRAND.version,
    baseline: {
      sourceVersion: BASELINE.sourceVersion,
      commit: BASELINE.commit,
      catalogRevision: BASELINE.catalog.dataRevision,
    },
  });
}
