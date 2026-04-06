"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";

interface CardProps extends React.PropsWithChildren<HTMLMotionProps<"div">> {
  glow?: boolean;
}

export function Card({ className = "", children, glow = false, ...props }: CardProps) {
  return (
    <motion.div
      className={`relative glass-panel rounded-[2rem] p-8 overflow-hidden group ${className}`}
      {...props}
    >
      {glow && (
        <div className="absolute -inset-1 bg-gradient-to-r from-brand-500/20 to-accent/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      )}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
