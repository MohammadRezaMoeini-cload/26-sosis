
import React from 'react';

// type IconProps = {
//   className?: string;
// };

export const PlayIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const PauseIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

export const SpeakerIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);

export const SpeakerHalfIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
  </svg>
);

export const SpeakerMutedIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
  </svg>
);

export const WholeNoteIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12 a6 6 0 1 0 0-12 a6 6 0 0 0 0 12z" transform="skewX(-15) translate(3, 6)" />
  </svg>
);

export const QuarterNoteIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
  </svg>
);

export const HalfNoteIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 17a3 3 0 100-6 3 3 0 000 6z" />
    <path d="M13 17V5" />
  </svg>
);


export const EighthNoteIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    <path d="M16 7h-4V4.5L16 3z" />
  </svg>
);

export const SixteenthNoteIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    <path d="M16 7h-4V4.5L16 3z" />
    <path d="M16 9h-4V6.5L16 5z" />
  </svg>
);

// New, more accurate 32nd Note Icon
export const ThirtySecondNoteIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    <path d="M16 7h-4V4.5L16 3z" />
    <path d="M16 9h-4V6.5L16 5z" />
    <path d="M16 11h-4V8.5L16 7z" />
  </svg>
);

// New 64th Note Icon
export const SixtyFourthNoteIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    <path d="M16 7h-4V4.5L16 3z" />
    <path d="M16 9h-4V6.5L16 5z" />
    <path d="M16 11h-4V8.5L16 7z" />
    <path d="M16 13h-4V10.5L16 9z" />
  </svg>
);

export const OneHundredTwentyEighthNoteIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    <path d="M16 7h-4V4.5L16 3z" />
    <path d="M16 9h-4V6.5L16 5z" />
    <path d="M16 11h-4V8.5L16 7z" />
    <path d="M16 13h-4V10.5L16 9z" />
    <path d="M16 15h-4V12.5L16 11z" />
  </svg>
);

export const TripletIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M15 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zM9 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V3H9z" />
    <path d="M15 8h-6v-1h6v1z" />
    <text x="10" y="6" fontSize="3" fill="currentColor">3</text>
  </svg>
);

export const SettingsIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
  </svg>
);

export const ListIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
  </svg>
);

// ==== Icons for Whole Note Based Subdivisions ====
export const SubWholeNoteIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M16 16 a8 8 0 1 0 0-16 a8 8 0 0 0 0 16z" transform="skewX(-15) translate(4, 8)" /></svg>;
export const SubTwoHalvesIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2" fill="none"><path d="M8 22 a4 4 0 1 0 0-8 a4 4 0 0 0 0 8z M12 22 V5 M20 22 a4 4 0 1 0 0-8 a4 4 0 0 0 0 8z M24 22 V5" /></svg>;
export const SubRestHalfIcon = ({ className }) =>  <svg width="32" height="32" viewBox="0 0 164 180" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M136 0H134V88H136V0Z" fill="white"/>
<path d="M105.323 97.3935C101.796 92.1509 105.575 84.6147 113.638 80.5736C121.701 76.5324 131.149 77.297 134.677 82.5395C138.204 87.7821 134.425 95.3183 126.362 99.4687C118.299 103.51 108.851 102.636 105.323 97.3935ZM133.417 83.1949C132.031 81.0104 124.976 82.2119 117.669 85.9254C117.543 85.9254 117.543 86.0346 117.417 86.0346C117.291 86.0346 117.165 86.1438 117.165 86.1438C109.985 89.8573 105.323 94.5537 106.835 96.6289C108.221 98.8133 115.276 97.6119 122.583 93.8984C122.709 93.8984 122.709 93.7892 122.835 93.7892L122.961 93.68C130.141 90.0757 134.803 85.3793 133.417 83.1949Z" fill="white"/>
<path d="M55.928 69.7547V58.1507H23.4719V69.7547H0V74H79.4026V69.7547H55.928Z" fill="white"/>
</svg>;
export const SubHalfTripletIcon = ({ className }) => <svg width="32" height="32" viewBox="0 0 258 180" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M144 0H142V88H144V0Z" fill="white"/>
<path d="M113.323 97.3935C109.796 92.1509 113.575 84.6147 121.638 80.5736C129.701 76.5324 139.149 77.297 142.677 82.5395C146.204 87.7821 142.425 95.3183 134.362 99.4687C126.299 103.51 116.851 102.636 113.323 97.3935ZM141.417 83.1949C140.031 81.0104 132.976 82.2119 125.669 85.9254C125.543 85.9254 125.543 86.0346 125.417 86.0346C125.291 86.0346 125.165 86.1438 125.165 86.1438C117.985 89.8573 113.323 94.5537 114.835 96.6289C116.221 98.8133 123.276 97.6119 130.583 93.8984C130.709 93.8984 130.709 93.7892 130.835 93.7892L130.961 93.68C138.141 90.0757 142.803 85.3793 141.417 83.1949Z" fill="white"/>
<path d="M58 0H56V88H58V0Z" fill="white"/>
<path d="M27.3233 97.3935C23.7958 92.1509 27.5752 84.6147 35.638 80.5736C43.7007 76.5324 53.1493 77.297 56.6768 82.5395C60.2042 87.7821 56.4248 95.3183 48.362 99.4687C40.2993 103.51 30.8507 102.636 27.3233 97.3935ZM55.417 83.1949C54.0312 81.0104 46.9762 82.2119 39.6694 85.9254C39.5434 85.9254 39.5434 86.0346 39.4174 86.0346C39.2914 86.0346 39.1654 86.1438 39.1654 86.1438C31.9845 89.8573 27.3233 94.5537 28.835 96.6289C30.2208 98.8133 37.2757 97.6119 44.5826 93.8984C44.7086 93.8984 44.7086 93.7892 44.8346 93.7892L44.9606 93.68C52.1415 90.0757 56.8027 85.3793 55.417 83.1949Z" fill="white"/>
<path d="M230 0H228V88H230V0Z" fill="white"/>
<path d="M199.323 97.3935C195.796 92.1509 199.575 84.6147 207.638 80.5736C215.701 76.5324 225.149 77.297 228.677 82.5395C232.204 87.7821 228.425 95.3183 220.362 99.4687C212.299 103.51 202.851 102.636 199.323 97.3935ZM227.417 83.1949C226.031 81.0104 218.976 82.2119 211.669 85.9254C211.543 85.9254 211.543 86.0346 211.417 86.0346C211.291 86.0346 211.165 86.1438 211.165 86.1438C203.985 89.8573 199.323 94.5537 200.835 96.6289C202.221 98.8133 209.276 97.6119 216.583 93.8984C216.709 93.8984 216.709 93.7892 216.835 93.7892L216.961 93.68C224.141 90.0757 228.803 85.3793 227.417 83.1949Z" fill="white"/>
</svg>
;
export const SubFourQuartersWholeIcon = ({ className }) => <svg width="60" height="60" viewBox="0 0 344 180" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M316 0H314V88H316V0Z" fill="white"/>
<path d="M285.323 97.3935C281.796 92.1509 285.575 84.6147 293.638 80.5736C301.701 76.5324 311.149 77.297 314.677 82.5395C318.204 87.7821 314.425 95.3183 306.362 99.4687C298.299 103.51 288.851 102.636 285.323 97.3935Z" fill="white"/>
<path d="M230 0H228V88H230V0Z" fill="white"/>
<path d="M199.323 97.3935C195.796 92.1509 199.575 84.6147 207.638 80.5736C215.701 76.5324 225.149 77.297 228.677 82.5395C232.204 87.7821 228.425 95.3183 220.362 99.4687C212.299 103.51 202.851 102.636 199.323 97.3935Z" fill="white"/>
<path d="M144 0H142V88H144V0Z" fill="white"/>
<path d="M113.323 97.3935C109.796 92.1509 113.575 84.6147 121.638 80.5736C129.701 76.5324 139.149 77.297 142.677 82.5395C146.204 87.7821 142.425 95.3183 134.362 99.4687C126.299 103.51 116.851 102.636 113.323 97.3935Z" fill="white"/>
<path d="M58 0H56V88H58V0Z" fill="white"/>
<path d="M27.3233 97.3935C23.7958 92.1509 27.5752 84.6147 35.638 80.5736C43.7007 76.5324 53.1493 77.297 56.6768 82.5395C60.2042 87.7821 56.4248 95.3183 48.362 99.4687C40.2993 103.51 30.8507 102.636 27.3233 97.3935Z" fill="white"/>
</svg>
;
export const SubQuarterTripletsWholeIcon = ({ className }) => <svg width="60" height="60" viewBox="0 0 516 180" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M58 0H56V88H58V0Z" fill="white"/>
<path d="M27.3233 97.3935C23.7958 92.1509 27.5752 84.6147 35.638 80.5736C43.7007 76.5324 53.1493 77.297 56.6768 82.5395C60.2042 87.7821 56.4248 95.3183 48.362 99.4687C40.2993 103.51 30.8507 102.636 27.3233 97.3935Z" fill="white"/>
<path d="M488 0H486V88H488V0Z" fill="white"/>
<path d="M457.323 97.3935C453.796 92.1509 457.575 84.6147 465.638 80.5736C473.701 76.5324 483.149 77.297 486.677 82.5395C490.204 87.7821 486.425 95.3183 478.362 99.4687C470.299 103.51 460.851 102.636 457.323 97.3935Z" fill="white"/>
<path d="M402 0H400V88H402V0Z" fill="white"/>
<path d="M371.323 97.3935C367.796 92.1509 371.575 84.6147 379.638 80.5736C387.701 76.5324 397.149 77.297 400.677 82.5395C404.204 87.7821 400.425 95.3183 392.362 99.4687C384.299 103.51 374.851 102.636 371.323 97.3935Z" fill="white"/>
<path d="M316 0H314V88H316V0Z" fill="white"/>
<path d="M285.323 97.3935C281.796 92.1509 285.575 84.6147 293.638 80.5736C301.701 76.5324 311.149 77.297 314.677 82.5395C318.204 87.7821 314.425 95.3183 306.362 99.4687C298.299 103.51 288.851 102.636 285.323 97.3935Z" fill="white"/>
<path d="M230 0H228V88H230V0Z" fill="white"/>
<path d="M199.323 97.3935C195.796 92.1509 199.575 84.6147 207.638 80.5736C215.701 76.5324 225.149 77.297 228.677 82.5395C232.204 87.7821 228.425 95.3183 220.362 99.4687C212.299 103.51 202.851 102.636 199.323 97.3935Z" fill="white"/>
<path d="M144 0H142V88H144V0Z" fill="white"/>
<path d="M113.323 97.3935C109.796 92.1509 113.575 84.6147 121.638 80.5736C129.701 76.5324 139.149 77.297 142.677 82.5395C146.204 87.7821 142.425 95.3183 134.362 99.4687C126.299 103.51 116.851 102.636 113.323 97.3935Z" fill="white"/>
</svg>
;
export const SubSextupletRnnIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" fill="currentColor"><path d="M10 25V5h2v14a2 2 0 100 6z M22 25V5h2v14a2 2 0 100 6z M5 5h10V3H5z M17 5h10V3H17z" /><text x="7" y="9" fontSize="6">3</text><text x="19" y="9" fontSize="6">3</text></svg>;
export const SubSextupletNrnIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" fill="currentColor"><path d="M4 25V5h2v14a2 2 0 100 6z M12 25V5h2v14a2 2 0 100 6z M18 25V5h2v14a2 2 0 100 6z M26 25V5h2v14a2 2 0 100 6z M5 5h8V3H5z M19 5h8V3h-8z" /><text x="6" y="9" fontSize="6">3</text><text x="20" y="9" fontSize="6">3</text></svg>;


// ==== Icons for Quarter Note Based Subdivisions ====
export const SubdivisionQuarterIcon = ({ className }) => <QuarterNoteIcon className={className} />;
export const SubdivisionEighthIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2" fill="none"><path d="M8 30 V8 m0 0 c0 -6 8 -6 8 0 v 14 m-8 -14 h 8" /></svg>;
export const SubdivisionEighthOffbeatIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2" fill="none"><path d="M8 16 v-4 h4 v-4 h-4 v4 h-4 v4 z M20 30 V8 m0 0 c0 -6 8 -6 8 0 v 14 m-8 -14 h 8" /></svg>;
export const SubdivisionEighthTripletIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2" fill="none"><path d="M4 30 V8 c0 -6 6 -6 6 0 v14 m-6 -14 h 16 M14 30 V8 c0 -6 6 -6 6 0 v14 M24 30 V8 c0 -6 6 -6 6 0 v14 M10 8 h16" /><text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubdivisionSixteenthIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2" fill="none"><path d="M4 30 V8 c0 -6 6 -6 6 0 v14 m-6 -14 h 24 M12 30 V8 c0 -6 6 -6 6 0 v14 M20 30 V8 c0 -6 6 -6 6 0 v14 M28 30 V8 c0 -6 6 -6 6 0 v14 M10 8 h18 M10 12 h18" /></svg>;

export const SubdivisionTripletRestNoteNoteIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2" fill="none">
    <path d="M6 16 v-4 h3 v-3 h-3 v4 h-3 v3 z" stroke="none" fill="currentColor" />
    <path d="M14 30 V8 c0 -6 6 -6 6 0 v14" />
    <path d="M24 30 V8 c0 -6 6 -6 6 0 v14" />
    <path d="M4 8 h26" />
    <text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text>
  </svg>
);

export const SubdivisionTripletNoteRestNoteIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2" fill="none">
    <path d="M4 30 V8 c0 -6 6 -6 6 0 v14" />
    <path d="M16 16 v-4 h3 v-3 h-3 v4 h-3 v3 z" stroke="none" fill="currentColor" />
    <path d="M24 30 V8 c0 -6 6 -6 6 0 v14" />
    <path d="M4 8 h26" />
    <text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text>
  </svg>
);

export const SubdivisionTripletNoteNoteRestIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2" fill="none">
    <path d="M4 30 V8 c0 -6 6 -6 6 0 v14" />
    <path d="M14 30 V8 c0 -6 6 -6 6 0 v14" />
    <path d="M26 16 v-4 h3 v-3 h-3 v4 h-3 v3 z" stroke="none" fill="currentColor" />
    <path d="M4 8 h26" />
    <text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text>
  </svg>
);


// ==== Icons for Half Note Based Subdivisions ====
export const SubHalfNoteIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1.5" fill="none"><path d="M12 25 a5 5 0 1 0 0-10 a5 5 0 0 0 0 10Z M17 25 V5" /></svg>;
export const SubTwoQuartersIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" fill="currentColor"><path d="M9 25 V5 h2 v11.55 a4 4 0 1 0 0 8.45 V25z M21 25 V5 h2 v11.55 a4 4 0 1 0 0 8.45 V25z" /></svg>;
export const SubRestQuarterIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" fill="currentColor"><path d="M8 10 h2 v2 l2-2 v-2 h2 v6 l-2 2 v2 h-2 v-2 l-2 2 v2 h-2 z M20 25 V5 h2 v11.55 a4 4 0 1 0 0 8.45 V25z" /></svg>;
export const SubQuarterTripletIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" fill="currentColor"><path d="M5 25 V5 h2 v14 a2 2 0 1 0 0 6z M14 25 V5 h2 v14 a2 2 0 1 0 0 6z M23 25 V5 h2 v14 a2 2 0 1 0 0 6z M6 6 h18 v-2 h-18 z" /><text x="13" y="10" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubFourEighthsIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" fill="currentColor"><path d="M4 25 V5 h2 v14 a2 2 0 1 0 0 6z M11 25 V5 h2 v14 a2 2 0 1 0 0 6z M18 25 V5 h2 v14 a2 2 0 1 0 0 6z M25 25 V5 h2 v14 a2 2 0 1 0 0 6z M5 5 h22 v-2 H5z" /></svg>;
export const SubEighthTripletsIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" fill="currentColor"><path d="M3 25V5h2v14a2 2 0 100 6zM8 25V5h2v14a2 2 0 100 6zM13 25V5h2v14a2 2 0 100 6zM18 25V5h2v14a2 2 0 100 6zM23 25V5h2v14a2 2 0 100 6zM28 25V5h2v14a2 2 0 100 6z M4 5h10V3H4z M19 5h10V3H19z" /><text x="6" y="9" fontSize="6">3</text><text x="21" y="9" fontSize="6">3</text></svg>;
export const SubTripletMiddleNoteIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" fill="currentColor"><path d="M10 25V5h2v14a2 2 0 100 6z M22 25V5h2v14a2 2 0 100 6z M5 5h10V3H5z M17 5h10V3H17z" /><text x="7" y="9" fontSize="6">3</text><text x="19" y="9" fontSize="6">3</text></svg>;
export const SubTripletSwingIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" fill="currentColor"><path d="M4 25V5h2v14a2 2 0 100 6z M12 25V5h2v14a2 2 0 100 6z M18 25V5h2v14a2 2 0 100 6z M26 25V5h2v14a2 2 0 100 6z M5 5h8V3H5z M19 5h8V3h-8z" /><text x="6" y="9" fontSize="6">3</text><text x="20" y="9" fontSize="6">3</text></svg>;

// ==== Icons for Eighth Note Based Subdivisions ====
export const SubdivisionSixteenthOffbeatIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2" fill="none"><path d="M8 16 v-4 h4 v-4 h-4 v4 h-4 v4 z" /><path d="M20 30 V8 c0 -6 8 -6 8 0 v 14 m-8 -14 h 8 m0 4 h-8" /></svg>;
export const SubdivisionSixteenthTripletIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2" fill="none"><path d="M4 30 V8 c0 -6 6 -6 6 0 v14 m-6 -14 h 16 M14 30 V8 c0 -6 6 -6 6 0 v14 M24 30 V8 c0 -6 6 -6 6 0 v14 M10 8 h16 M10 12 h16" /><text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubdivisionSixteenthTripletRestNoteNoteIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2" fill="none"><path d="M6 16 v-4 h3 v-3 h-3 v4 h-3 v3 z" stroke="none" fill="currentColor" /><path d="M14 30 V8 c0 -6 6 -6 6 0 v14" /><path d="M24 30 V8 c0 -6 6 -6 6 0 v14" /><path d="M4 8 h26 M4 12 h26" /><text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubdivisionSixteenthTripletNoteRestNoteIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2" fill="none"><path d="M4 30 V8 c0 -6 6 -6 6 0 v14" /><path d="M16 16 v-4 h3 v-3 h-3 v4 h-3 v3 z" stroke="none" fill="currentColor" /><path d="M24 30 V8 c0 -6 6 -6 6 0 v14" /><path d="M4 8 h26 M4 12 h26" /><text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubdivisionSixteenthTripletNoteNoteRestIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="2" fill="none"><path d="M4 30 V8 c0 -6 6 -6 6 0 v14" /><path d="M14 30 V8 c0 -6 6 -6 6 0 v14" /><path d="M26 16 v-4 h3 v-3 h-3 v4 h-3 v3 z" stroke="none" fill="currentColor" /><path d="M4 8 h26 M4 12 h26" /><text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubdivisionThirtySecondIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1.5" fill="none"><path d="M2 30V8c0-6 5-6 5 0v14m-5-14h28M9 30V8c0-6 5-6 5 0v14m-5-14h21m-21 4h21M16 30V8c0-6 5-6 5 0v14m-5-14h14m-14 4h14m-14 4h14M23 30V8c0-6 5-6 5 0v14m-5-14h7m-7 4h7m-7 4h7" /></svg>;

// ==== Icons for Sixteenth Note Based Subdivisions ====
export const SubdivisionThirtySecondOffbeatIcon = ({ className }) => <svg height="30" viewBox="0 0 109 104" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M88.1181 39.4264C83.8248 36.7624 79.4342 33.461 76.1489 29.7277C77.3769 30.7063 78.5329 30.4957 81.4582 31.4557C93.6636 35.4611 101.826 40.5624 103.677 52.7891C103.677 52.7891 103.688 53.0423 103.71 53.4543C99.6942 47.7623 93.8301 42.9717 88.1181 39.4264ZM81.4582 18.7504C93.6636 22.7557 101.826 27.857 103.677 40.0837C103.677 40.0837 103.681 40.1917 103.69 40.377C99.6861 34.8837 93.9809 30.2544 88.4196 26.8037C82.9276 23.3944 79.6862 21.7397 77.5756 17.7424C78.4742 18.0064 79.6142 18.145 81.4582 18.7504ZM107.706 61.2597C107.487 60.577 107.229 59.905 106.951 59.2397C109.241 53.365 108.009 48.637 108.009 48.637C107.745 47.8157 107.424 47.0104 107.074 46.2144C109.198 40.489 108.009 35.9317 108.009 35.9317C105.073 26.7704 96.5862 19.1664 88.4196 14.0984C81.7036 9.93036 78.6729 8.85033 76.6875 2.505C76.6275 2.04234 76.5342 1.56634 76.3809 1.14368C76.3476 1.05434 76.2876 0.978333 76.2316 0.899666C76.2289 0.887665 76.2248 0.878365 76.2222 0.867699C76.2222 0.873032 76.2209 0.877014 76.2209 0.882347C75.6115 0.0543442 73.8262 -0.161659 72.8875 0.110344C72.0862 0.343674 72.1288 1.28767 72.1288 2.04634C72.1288 2.21301 72.1328 2.38638 72.1342 2.55572L71.9769 77.4344C67.5569 75.237 60.8036 75.8437 54.4422 79.1517C45.6036 83.7477 40.8915 92.1877 43.9155 98.0037C46.9395 103.82 56.5555 104.81 65.3942 100.214C72.7702 96.3784 75.6395 90.045 75.6062 84.6344V41.113C77.6902 42.3397 77.8941 42.585 81.1568 44.0784C92.8368 49.4264 106.47 63.729 101.714 76.6344C101.081 78.3517 99.1315 81.5864 98.2769 83.1984C96.3329 86.8637 101.349 85.8757 103.36 82.917C107.848 76.3157 110.113 68.769 107.706 61.2597Z" fill="white" />
  <path d="M35.2348 6.0249L29.9595 6.00002C29.5827 5.99802 29.2641 6.18414 29.2112 6.43697L26.2827 20.4846C23.9412 20.9265 20.1823 21.2739 16.4658 20.1073C19.0242 19.1895 20.7958 17.2305 20.7958 14.9559C20.7958 11.8024 17.4006 9.24611 13.2134 9.24611C9.80359 9.24611 6.91997 10.9404 5.96539 13.2727C4.53088 16.4172 6.69256 18.9237 6.69256 18.9237C11.0807 23.6053 17.0053 25.0088 22.11 25.0088C23.251 25.0088 24.3471 24.9352 25.3796 24.8157L22.976 36.3408C20.6199 36.733 17.1348 36.953 13.6867 35.87C16.2437 34.9522 18.0153 32.9942 18.0153 30.7186C18.0153 27.5651 14.6214 25.0088 10.4329 25.0088C7.0231 25.0088 4.14084 26.703 3.18626 29.0343C1.75043 32.1799 3.91215 34.6874 3.91215 34.6874C8.30031 39.368 14.2248 40.7725 19.3295 40.7725C20.2828 40.7725 21.2004 40.7197 22.0809 40.6331L19.5503 52.7715C17.2353 53.084 14.0978 53.1646 10.9921 52.1891C13.5505 51.2713 15.3221 49.3133 15.3221 47.0378C15.3221 43.8842 11.9269 41.3289 7.73839 41.3289C4.32993 41.3289 1.44635 43.0232 0.491771 45.3545C-0.942744 48.5 1.21765 51.0066 1.21765 51.0066C5.60581 55.6871 11.5303 57.0916 16.6364 57.0916C17.3318 57.0916 18.0061 57.0608 18.6658 57.013L13.7924 80.3798C13.7277 80.6914 14.086 80.9721 14.55 80.9751L19.8253 81C20.2021 81.002 20.5194 80.8158 20.5723 80.563L35.9924 6.62017C36.0572 6.30859 35.6989 6.02789 35.2348 6.0249Z" fill="white" />
</svg>;
export const SubdivisionThirtySecondTripletIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1.5" fill="none"><path d="M4 30V8c0-6 6-6 6 0v14m-6-14h16M14 30V8c0-6 6-6 6 0v14M24 30V8c0-6 6-6 6 0v14M10 8h16M10 12h16M10 16h16" /><text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubdivisionThirtySecondTripletRestNoteNoteIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1.5" fill="none"><path d="M6 16 v-4 h3 v-3 h-3 v4 h-3 v3 z" stroke="none" fill="currentColor" /><path d="M14 30V8c0-6 6-6 6 0v14" /><path d="M24 30V8c0-6 6-6 6 0v14" /><path d="M4 8h26M4 12h26M4 16h26" /><text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubdivisionThirtySecondTripletNoteRestNoteIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1.5" fill="none"><path d="M4 30V8c0-6 6-6 6 0v14" /><path d="M16 16 v-4 h3 v-3 h-3 v4 h-3 v3 z" stroke="none" fill="currentColor" /><path d="M24 30V8c0-6 6-6 6 0v14" /><path d="M4 8h26M4 12h26M4 16h26" /><text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubdivisionThirtySecondTripletNoteNoteRestIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1.5" fill="none"><path d="M4 30V8c0-6 6-6 6 0v14" /><path d="M14 30V8c0-6 6-6 6 0v14" /><path d="M26 16 v-4 h3 v-3 h-3 v4 h-3 v3 z" stroke="none" fill="currentColor" /><path d="M4 8h26M4 12h26M4 16h26" /><text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubdivisionSixtyFourthIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1" fill="none"><path d="M2 30V8c0-6 5-6 5 0v14m-5-14h28M9 30V8c0-6 5-6 5 0v14m-5-14h21m-21 3h21m-21 3h21M16 30V8c0-6 5-6 5 0v14m-5-14h14m-14 3h14m-14 3h14m-14 3h14M23 30V8c0-6 5-6 5 0v14m-5-14h7m-7 3h7m-7 3h7m-7 3h7" /></svg>;

// ==== Icons for Thirty-second Note Based Subdivisions ====
export const SubdivisionSixtyFourthOffbeatIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1" fill="none"><path d="M8 16 v-4 h4 v-4 h-4 v4 h-4 v4 z" /><path d="M20 30 V8 c0 -6 8 -6 8 0 v 14 m-8 -14 h 8 m0 3 h-8 m0 3 h-8 m0 3 h-8" /></svg>;
export const SubdivisionSixtyFourthTripletIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1" fill="none"><path d="M4 30V8c0-6 6-6 6 0v14m-6-14h16M14 30V8c0-6 6-6 6 0v14M24 30V8c0-6 6-6 6 0v14M10 8h16M10 11h16M10 14h16M10 17h16" /><text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubdivisionSixtyFourthTripletRestNoteNoteIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1" fill="none"><path d="M6 16 v-4 h3 v-3 h-3 v4 h-3 v3 z" stroke="none" fill="currentColor" /><path d="M14 30V8c0-6 6-6 6 0v14" /><path d="M24 30V8c0-6 6-6 6 0v14" /><path d="M4 8h26M4 11h26M4 14h26M4 17h26" /><text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubdivisionSixtyFourthTripletNoteRestNoteIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1" fill="none"><path d="M4 30V8c0-6 6-6 6 0v14" /><path d="M16 16 v-4 h3 v-3 h-3 v4 h-3 v3 z" stroke="none" fill="currentColor" /><path d="M24 30V8c0-6 6-6 6 0v14" /><path d="M4 8h26M4 11h26M4 14h26M4 17h26" /><text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubdivisionSixtyFourthTripletNoteNoteRestIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1" fill="none"><path d="M4 30V8c0-6 6-6 6 0v14" /><path d="M14 30V8c0-6 6-6 6 0v14" /><path d="M26 16 v-4 h3 v-3 h-3 v4 h-3 v3 z" stroke="none" fill="currentColor" /><path d="M4 8h26M4 11h26M4 14h26M4 17h26" /><text x="15" y="6" fontSize="6" stroke="none" fill="currentColor">3</text></svg>;
export const SubdivisionOneTwentyEighthIcon = ({ className }) => <svg className={className} viewBox="0 0 32 32" stroke="currentColor" strokeWidth="0.8" fill="none"><path d="M1 30V8c0-6 5-6 5 0v14m-5-14h30M8 30V8c0-6 5-6 5 0v14m-5-14h23m-23 2.5h23m-23 2.5h23m-23 2.5h23M15 30V8c0-6 5-6 5 0v14m-5-14h16m-16 2.5h16m-16 2.5h16m-16 2.5h16M22 30V8c0-6 5-6 5 0v14m-5-14h9m-9 2.5h9m-9 2.5h9m-9 2.5h9" /></svg>;
