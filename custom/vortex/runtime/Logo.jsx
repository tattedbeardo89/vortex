// ../pub-game-store/native/ui/Logo.jsx
// reconstructed from the esbuild bundle in eboot.bin

import '../assets/Inter-Regular.ttf';
import { jsx, jsxs } from 'react/jsx-runtime';
import { Path, Svg, Text, View } from '@ps5-react/core';
import { colors } from './colors.js';
import { px } from './scale.js';

  function Logo({ color = colors.fg }) {
    return /* @__PURE__ */ (0, jsxs)(View, { style: { flexDirection: "row", alignItems: "center", gap: 12 }, children: [
      /* @__PURE__ */ (0, jsxs)(Svg, { width: px(28), height: px(28), viewBox: "0 0 32 32", children: [
        /* @__PURE__ */ (0, jsx)(Path, { d: "M26 12a11 11 0 1 1-8-7M18 5l7 3-6 4", fill: "none", stroke: color, strokeWidth: 4.5 }),
        /* @__PURE__ */ (0, jsx)(Path, { d: "M25 5 19 19 5 25 11 11Z", fill: color })
      ] }),
      /* @__PURE__ */ (0, jsx)(Text, { style: [{ fontFamily: "Inter-Regular", fontSize: 29, fontWeight: 600, letterSpacing: -0.85 }, { color }], children: "Vortex" })
    ] });
  }

export { Logo };
