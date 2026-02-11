import React from 'react';

interface Props {
  platform: 'LeetCode' | 'GFG' | 'Other' | string;
  className?: string;
}

export const PlatformIcon: React.FC<Props> = ({ platform, className = "w-5 h-5" }) => {
  const p = platform.toLowerCase();

  if (p === 'leetcode') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-orange-500`}>
        <title>LeetCode</title>
        <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.173 5.798a5.918 5.918 0 0 0-.483 8.423l.112.146.008.01 2.923 2.924a1.372 1.372 0 0 0 2.275-1.55l-2.483-3.23a3.176 3.176 0 0 1 .586-4.52l4.316-4.316a1.374 1.374 0 0 0-.947-2.684Zm-2.665 4.316a1.371 1.371 0 0 0-1.282.902L6.152 16.33a5.922 5.922 0 0 0 4.295 7.625l.18.026.012.001a1.37 1.37 0 0 0 1.25-2.07l-.024-.055-1.93-5.793a3.18 3.18 0 0 1 2.304-4.093l.006-.002 6.097-1.128a1.372 1.372 0 1 0-.5-2.697L11.745 9.27a1.371 1.371 0 0 0-.927-4.954ZM18.9 9.873a1.372 1.372 0 0 0-.012 2.744l.285.004a3.176 3.176 0 0 1 3.125 3.173 3.176 3.176 0 0 1-3.125 3.173l-.406.004a1.372 1.372 0 0 0 .012 2.744l.406-.004A5.92 5.92 0 0 0 25.04 15.8a5.92 5.92 0 0 0-5.856-5.92l-.285-.004Z" transform="translate(-4)"/>
      </svg>
    );
  }

  if (p === 'gfg' || p === 'geeksforgeeks') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-green-600`}>
         <title>GeeksForGeeks</title>
         <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 16h-2v-6h2v6zm4 0h-2v-6h2v6z" />
         <path d="M8 8h8v2H8z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${className} text-gray-400`}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
};