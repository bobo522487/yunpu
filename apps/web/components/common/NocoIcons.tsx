import React from 'react';
import { AssetColorTheme } from '../../types';
import { ASSET_COLOR_PALETTES } from '../../store/useWorkspaceStore';

export const WorkspaceLogoIcon: React.FC<{ className?: string }> = ({
  className = 'w-7 h-7',
}) => (
  <svg
    className={`select-none flex-none ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 25 24"
    fill="none"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.45966 0.828125C3.71728 0.828125 1.49414 3.05126 1.49414 5.79364V17.3798C1.49414 20.1222 3.71728 22.3454 6.45966 22.3454H18.0459C18.0735 22.3454 18.1011 22.3452 18.1286 22.3447C18.0743 22.0774 18.0459 21.8008 18.0459 21.5176C18.0459 19.2327 19.8993 17.3798 22.1859 17.3798C22.4683 17.3798 22.7442 17.4082 23.0107 17.4623C23.0112 17.4348 23.0114 17.4074 23.0114 17.3798V5.79364C23.0114 3.05126 20.7882 0.828125 18.0459 0.828125H6.45966Z"
      fill="url(#nc-ws-grad-bg)"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.04575 2.89648C4.67456 2.89648 3.56299 4.00805 3.56299 5.37924V17.793C3.56299 19.1642 4.67456 20.2758 6.04575 20.2758H18.2353C18.6395 18.9895 19.6554 17.9737 20.9423 17.5691V5.37924C20.9423 4.00805 19.8307 2.89648 18.4595 2.89648H6.04575Z"
      fill="white"
    />
    <path
      d="M9.75798 11.4715V15.8553C9.75798 16.6378 9.19555 17.2724 8.50191 17.2712L6.45972 17.2671L6.47043 12.1926V12.0286C6.48773 10.7594 7.52076 9.95062 8.47448 10.2876C8.70587 10.3699 8.91347 10.5226 9.08519 10.7158L9.75798 11.4715Z"
      fill="#3740D0"
    />
    <path
      d="M14.7468 11.7955V7.20889C14.7468 6.42579 15.3099 5.79119 16.0035 5.79297L18.0457 5.79657L18.035 11.0744V11.2378C18.0171 12.5076 16.9841 13.3164 16.0309 12.9788C15.7989 12.8971 15.592 12.7444 15.4202 12.5512L14.7468 11.7955Z"
      fill="#3740D0"
    />
    <path
      d="M18.0314 10.8896V14.7181C18.041 16.5629 16.3375 17.8112 14.9974 17.0311C14.8345 16.9362 14.6878 16.8104 14.5554 16.6678L10.3935 12.1851L9.7577 11.4717L9.08495 10.716C8.91319 10.5228 8.70559 10.3701 8.47419 10.2878C7.52048 9.95082 6.48749 10.7596 6.47019 12.0288V11.9865L6.46899 8.7711V8.24264C6.46899 6.24936 8.44854 5.1281 9.80603 6.35434L15.2658 12.3187C15.397 12.4624 15.5532 12.5835 15.7316 12.6622C16.7563 13.1179 18.0314 12.2346 18.0314 10.8896Z"
      fill="#4351E8"
    />
    <circle cx="22.185" cy="21.518" r="2.482" fill="#EE215D" />
    <defs>
      <linearGradient id="nc-ws-grad-bg" x1="5.8" y1="18" x2="24" y2="0" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4351E8" />
        <stop offset="1" stopColor="#2A1EA5" />
      </linearGradient>
    </defs>
  </svg>
);

export const ProjectLayersOutlineIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    className={`flex-none ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
  >
    <path
      d="M18.75 15C18.75 15.25 18.5221 15.4007 18.185 15.5542L11.2412 18.7161C10.5439 19.0336 9.41343 19.0336 8.71617 18.7161L1.77237 15.5542C1.43533 15.4007 1.25 15.125 1.25 15"
      stroke="currentColor"
      strokeWidth="1.66"
    />
    <path
      d="M18.75 10C18.75 10.25 18.5221 10.4007 18.185 10.5542L11.2412 13.7161C10.5439 14.0336 9.41343 14.0336 8.71617 13.7161L1.77237 10.5542C1.43533 10.4007 1.25 10.125 1.25 10"
      stroke="currentColor"
      strokeWidth="1.66"
    />
    <path d="M1.25 5V15M18.75 5V15" stroke="currentColor" strokeWidth="1.66" />
    <path
      d="M18.1856 5.79988L11.2417 8.96184C10.5445 9.27935 9.41401 9.27935 8.71675 8.96184L1.77295 5.79988C1.07568 5.48238 1.07568 4.9676 1.77295 4.65009L8.71675 1.48813C9.41401 1.17062 10.5445 1.17062 11.2417 1.48813L18.1856 4.65009C18.8828 4.9676 18.8828 5.48238 18.1856 5.79988Z"
      stroke="currentColor"
      strokeWidth="1.66"
    />
  </svg>
);

export const ProjectColoredIcon: React.FC<{
  colorTheme: AssetColorTheme;
  className?: string;
}> = ({ colorTheme, className = 'w-6 h-6' }) => {
  const palette = ASSET_COLOR_PALETTES[colorTheme] || ASSET_COLOR_PALETTES.sky;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M20.9561 16.9326C20.9445 17.1394 20.7656 17.3451 20.4189 17.5029L13.2764 20.7549C12.5592 21.0813 11.3968 21.0813 10.6797 20.7549L3.53711 17.5029C3.19045 17.3451 3.01152 17.1394 3 16.9326H3.00293V10.9326H21.0029V16.9326H20.9561Z"
        fill={palette.fillDark}
      />
      <path
        d="M21 12C20.9882 12.2033 20.8082 12.4054 20.4609 12.5605L13.3018 15.7588C12.5829 16.0799 11.4172 16.0799 10.6982 15.7588L3.53906 12.5605C3.19181 12.4054 3.01181 12.2033 3 12H21ZM10.6982 3.23926C11.4171 2.91975 12.5829 2.91975 13.3018 3.23926L20.4609 6.4209C20.8201 6.58052 20.9997 6.78982 21 6.99902H21.0068V11.999H3.00684V7.06055C2.9683 6.83124 3.14454 6.59625 3.53906 6.4209L10.6982 3.23926Z"
        fill={palette.fillLight}
      />
    </svg>
  );
};

export const AppColoredIcon: React.FC<{
  colorTheme: AssetColorTheme;
  className?: string;
}> = ({ colorTheme, className = 'w-6 h-6' }) => {
  const palette = ASSET_COLOR_PALETTES[colorTheme] || ASSET_COLOR_PALETTES.indigo;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <rect x="3" y="3" width="8.2" height="8.2" rx="2.2" fill={palette.fillLight} />
      <rect x="12.8" y="3" width="8.2" height="8.2" rx="2.2" fill={palette.fillDark} />
      <rect x="3" y="12.8" width="8.2" height="8.2" rx="2.2" fill={palette.fillDark} />
      <rect x="12.8" y="12.8" width="8.2" height="8.2" rx="2.2" fill={palette.fillLight} />
    </svg>
  );
};
