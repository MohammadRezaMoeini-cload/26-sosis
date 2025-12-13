import React from 'react';
import PropTypes from 'prop-types';

// Import all the icons
import beatsIcon from "./beatsIcon.jsx"
import sub18Icon from './sub1.8Icon.jsx';
import sub1Icon from './sub1.4Icon.jsx';
import sub24icon from './sub2.4Icon.jsx';
import sub4Icon from './sub4Icon.jsx';
import tablIcon from './tablIcon.jsx';
import editIcon from './editIcon.jsx';
import volumeIcon from './volumeIcon.jsx';
import playIcon from './playIcon.jsx';
import gitarIcon from './gitarIcon.jsx';
import violinIcon from './violinIcon.jsx';
import trumpetIcon from './trumpetIcon.jsx';
import ukuleleIcon from './ukuleleIcon.jsx';
import pianoIcon from './pianoIcon.jsx';
import stopIcon from './stopIcon.jsx';
import recordIcon from './recordIcon.jsx';
import record2Icon from './record2Icon.jsx';

import { rightIcon } from './rightIcon.jsx';
import { leftIcon } from './leftIcon.jsx';
import { zoominIcon } from './zoominIcon.jsx';
import { zoomoutIcon } from './zoomoutIcon.jsx';
import { saveIcon } from './saveIcon.jsx';
import { pauseIcon } from './pauseIcon.jsx';

import { note21 } from './note21.jsx';
import { note22 } from './note22.jsx';
import { note23 } from './note23.jsx';
import { note24 } from './note24.jsx';
import { note25 } from './note25.jsx';
import { note26 } from './note26.jsx';
import { note27 } from './note27.jsx';
import { note28 } from './note28.jsx';
import { note29 } from './note29.jsx';
import { note30 } from './note30.jsx';
import { note31 } from './note31.jsx';
import { note11 } from '../assets/note11';
import { note12 } from '../assets/note12';
import { note13 } from '../assets/note13';
import { note14 } from '../assets/note14';
import { note15 } from '../assets/note15';
import { note16 } from '../assets/note16';
import { note17 } from '../assets/note17';
import { note18 } from '../assets/note18';
import { note32 } from '../assets/note32';
import { note33 } from '../assets/note33';
import { note34 } from '../assets/note34';
import { note35 } from '../assets/note35';
import { note36 } from '../assets/note36';
import { note161 } from './note161.jsx';
import { note162 } from './note162.jsx';
import { note163 } from './note163.jsx';
import { note164 } from './note164.jsx';
import { noteT1 } from './noteT1.jsx';
import { noteT2 } from './noteT2.jsx';
import { noteT3 } from './noteT3.jsx';
import { singerIcon } from './singerIcon.jsx';
import { culturalIcon } from './culturalIcon.jsx';
// Create an object mapping icon names to their components

const ICONS = {
    beatsIcon,
    sub18Icon,
    sub1Icon,
    sub24icon,
    sub4Icon,
    tablIcon,
    editIcon,
    volumeIcon,
    playIcon,
    gitarIcon,
    violinIcon,
    trumpetIcon,
    ukuleleIcon,
    pianoIcon,
    stopIcon,
    recordIcon,
    record2Icon,

    rightIcon,leftIcon,
    zoominIcon,zoomoutIcon,saveIcon,pauseIcon,singerIcon,culturalIcon,
    note11, note12, note13, note14, note15, note16, note17, note18,
    note21, note22, note23,
    note24, note25, note26, note27,
    note28, note29, note30, note31, note32, note33, note34, note35, note36,
    note161, note162, note163, note164,
    noteT1, noteT2, noteT3
};
// Icon Component
const Icon = ({ name , size }) => {

  const SvgIcon = ICONS[name];
  if (!SvgIcon) {
    console.warn(`Icon "${name}" does not exist in ICONS mapping.`);
    return null;
  }

  return <SvgIcon width={size} height={size}/>;
};

Icon.propTypes = {
  name: PropTypes.oneOf(Object.keys(ICONS)).isRequired,
  size:PropTypes.number
};

Icon.defaultProps = {
  width: 24,
  height: 24,
  size:24
};

export default Icon;