// src/components/SpecialModeLinkify.tsx
import React from 'react';

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

export const linkifyText = (
  text: string,
  linkClassName: string = 'underline text-yellow-200 hover:text-yellow-100 font-semibold break-all'
): React.ReactNode[] => {
  if (!text) return [text];

  const parts = text.split(URL_REGEX);

  return parts.map((part, i) => {
    const isUrl = URL_REGEX.test(part);
    URL_REGEX.lastIndex = 0;

    if (isUrl) {
      return React.createElement(
        'a',
        {
          key: i,
          href: part,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: linkClassName,
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
        part
      );
    }

    return React.createElement(React.Fragment, { key: i }, part);
  });
};

export default linkifyText;