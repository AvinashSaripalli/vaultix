import React from 'react';
import logoLight from '../../assets/Vaultix.png';
import logoDark from '../../assets/VaultixDark.png';

/**
 * BrandLogo component that automatically switches between
 * light and dark mode versions of the Vaultix logo.
 */
export default function BrandLogo({ className = 'w-64 mb-10', alt = 'Vaultix', ...props }) {
  return (
    <>
      <img
        src={logoLight}
        alt={alt}
        className={`${className} dark:hidden`}
        {...props}
      />
      <img
        src={logoDark}
        alt={alt}
        className={`${className} hidden dark:block`}
        {...props}
      />
    </>
  );
}
