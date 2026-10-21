import '../assets/Inter-Regular.ttf';
import {jsx} from 'react/jsx-runtime';
import {useEffect} from 'react';
import {Text, View} from '@ps5-react/core';
import {BRAND} from '../vortex-brand.js';

export function Splash({onDone}) {
  useEffect(() => {
    const timer = setTimeout(onDone, 650);
    return () => clearTimeout(timer);
  }, [onDone]);
  return jsx(View, {style: {position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.theme.canvas},
    children: jsx(Text, {style: {fontFamily: 'Inter-Regular', fontSize: 66,
      fontWeight: 600, color: BRAND.theme.fg}, children: BRAND.name})});
}
