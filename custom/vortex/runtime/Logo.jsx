import '../assets/Inter-Regular.ttf';
import {jsx} from 'react/jsx-runtime';
import {Text} from '@ps5-react/core';
import {colors} from './colors.js';
import {BRAND} from '../vortex-brand.js';

// Text identity keeps the app buildable without generating binary artwork.
export function Logo({color = colors.fg}) {
  return jsx(Text, {style: {fontFamily: 'Inter-Regular', fontSize: 29, fontWeight: 600,
    letterSpacing: -0.85, color}, children: BRAND.name});
}
