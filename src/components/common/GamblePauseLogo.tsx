import React from 'react';

/**
 * Centralized GamblePause Logo Asset configuration.
 * To update the official brand logo across the entire CRM,
 * change GAMBLEPAUSE_LOGO_SRC or replace /icon.svg.
 */
export const GAMBLEPAUSE_LOGO_SRC = '/icon.svg';

export interface GamblePauseLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  alt?: string;
  onClick?: () => void;
}

export const GamblePauseLogo: React.FC<GamblePauseLogoProps> = ({
  className = '',
  size = 'md',
  alt = 'GamblePause Logo',
  onClick,
}) => {
  const sizeClasses = {
    xs: 'w-8 h-8 rounded-lg',
    sm: 'w-10 h-10 rounded-xl',
    md: 'w-12 h-12 rounded-xl',
    lg: 'w-16 h-16 rounded-2xl',
    xl: 'w-20 h-20 rounded-2xl',
    hero: 'w-24 h-24 sm:w-28 sm:h-28 rounded-3xl',
  }[size];

  return (
    <img
      src={GAMBLEPAUSE_LOGO_SRC}
      alt={alt}
      onClick={onClick}
      className={`object-contain shadow-md shadow-red-600/15 shrink-0 ${sizeClasses} ${className} ${onClick ? 'cursor-pointer' : ''}`}
    />
  );
};

export default GamblePauseLogo;
