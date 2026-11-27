import React from 'react';
import { type AssetColorTheme } from '../../types';
import { ASSET_COLOR_PALETTES } from '../../store/useWorkspaceStore';

export const WorkspaceLogoIcon: React.FC<{ className?: string }> = ({
  className = 'w-7 h-7',
}) => (
  <svg
    className={`select-none flex-none ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 28 28"
    fill="none"
    aria-hidden="true"
  >
    <rect
      x="1.5"
      y="1.5"
      width="25"
      height="25"
      rx="6.5"
      fill="url(#yp-seal-grad)"
    />
    <rect
      x="3.2"
      y="3.2"
      width="21.6"
      height="21.6"
      rx="5"
      stroke="#FAF7F2"
      strokeOpacity="0.28"
      strokeWidth="1"
    />
    {/* Lineage root & branches + archival scroll strokes */}
    <path
      d="M14 6.75V12.25M14 12.25H8.75C8.33579 12.25 8 12.5858 8 13V16.5M14 12.25H19.25C19.6642 12.25 20 12.5858 20 13V16.5M14 12.25V16.5"
      stroke="#FAF7F2"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="14" cy="6.75" r="1.6" fill="#FAF7F2" />
    <rect x="6.5" y="17.75" width="3" height="3.2" rx="0.9" fill="#FAF7F2" />
    <rect x="12.5" y="17.75" width="3" height="3.2" rx="0.9" fill="#FAF7F2" />
    <rect x="18.5" y="17.75" width="3" height="3.2" rx="0.9" fill="#FAF7F2" />
    <defs>
      <linearGradient id="yp-seal-grad" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop stopColor="#A63821" />
        <stop offset="1" stopColor="#752211" />
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
      <rect x="3" y="3" width="18" height="5.2" rx="1.8" fill={palette.fillDark} />
      <rect x="3" y="10.2" width="7.4" height="10.8" rx="1.8" fill={palette.fillLight} />
      <rect x="12.4" y="10.2" width="8.6" height="4.6" rx="1.5" fill={palette.fillLight} />
      <rect x="12.4" y="16.4" width="8.6" height="4.6" rx="1.5" fill={palette.fillDark} />
    </svg>
  );
};
