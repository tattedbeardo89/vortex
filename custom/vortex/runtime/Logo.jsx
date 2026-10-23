import { EMBLEM } from './vortex-emblem.js';
// ../pub-game-store/native/ui/Logo.jsx
// reconstructed from the esbuild bundle in eboot.bin

import '../assets/Inter-Regular.ttf';
import { jsx, jsxs } from 'react/jsx-runtime';
import { Path, Svg, Text, View } from '@ps5-react/core';
import { colors } from './colors.js';
import { px } from './scale.js';

  function Logo({ color = colors.fg }) {
    return /* @__PURE__ */ (0, jsxs)(View, { style: { flexDirection: "row", alignItems: "center", gap: 12 }, children: [
      /* @__PURE__ */ (0, jsxs)(Svg, { width: px(28), height: px(28), viewBox: "0 0 32 32", children: EMBLEM.map((path,index) => jsx(Path,path,index))  }),
      /* @__PURE__ */ (0, jsx)(Text, { style: [{ fontFamily: "Inter-Regular", fontSize: 29, fontWeight: 600, letterSpacing: -0.85 }, { color }], children: "Vortex" })
    ] });
  }

export { Logo };
