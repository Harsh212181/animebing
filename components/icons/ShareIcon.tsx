 import React from "react";

interface Props {
  className?: string;
}

const ShareIcon: React.FC<Props> = ({ className = "w-5 h-5" }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 12v6a2 2 0 002 2h12a2 2 0 002-2v-6M16 6l-4-4m0 0L8 6m4-4v12"
      />
    </svg>
  );
};

export default ShareIcon;
