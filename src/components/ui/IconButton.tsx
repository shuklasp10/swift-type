import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
}

export function IconButton({ icon, className = '', ...props }: IconButtonProps) {
  return (
    <button className={`btn-icon ${className}`} {...props}>
      {icon}
    </button>
  );
}
