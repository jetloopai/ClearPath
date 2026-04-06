"use client";

import React, { useRef, useState } from "react";
import { motion, HTMLMotionProps } from "framer-motion";

interface ButtonProps extends React.PropsWithChildren<HTMLMotionProps<"button">> {
  variant?: "primary" | "secondary" | "glass";
  magnetic?: boolean;
}

export function Button({ 
  children, 
  variant = "primary", 
  magnetic = false,
  className = "", 
  ...props 
}: ButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!magnetic || !buttonRef.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = buttonRef.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    setPosition({ x: middleX * 0.2, y: middleY * 0.2 });
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!magnetic) return;
    setPosition({ x: 0, y: 0 });
    if (props.onMouseLeave) {
      props.onMouseLeave(e);
    }
  };

  const baseStyles = "relative inline-flex items-center justify-center px-8 py-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-background rounded-full overflow-hidden group";
  
  const variants = {
    primary: "bg-foreground text-background hover:bg-zinc-200",
    secondary: "bg-surface-light text-foreground border border-border hover:bg-surface",
    glass: "glass-panel text-foreground hover:bg-white/10",
  };

  return (
    <motion.button
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      {variant === "primary" && (
        <span className="absolute inset-0 z-0 bg-gradient-to-r from-brand-400 to-brand-600 opacity-0 transition-opacity duration-300 group-hover:opacity-20" />
      )}
    </motion.button>
  );
}
