
import React from 'react';
import { GlobeAltIcon } from './IconComponents';

export const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-md">
      <div className="flex items-center space-x-3">
        <GlobeAltIcon className="h-8 w-8 text-blue-500" />
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Voice + Visual AI Travel Companion</h1>
      </div>
    </header>
  );
};
