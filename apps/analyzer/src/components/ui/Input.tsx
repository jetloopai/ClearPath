"use client";

import React, { forwardRef } from "react";
import { motion } from "framer-motion";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, icon, ...props }, ref) => {
    return (
      <div className="relative w-full group">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/0 via-brand-500/10 to-brand-500/0 rounded-[2rem] opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-xl" />
        <div className="relative flex items-center bg-surface-dark border border-border rounded-[2rem] overflow-hidden focus-within:border-brand-500/50 focus-within:ring-1 focus-within:ring-brand-500/50 transition-all duration-300">
          {icon && (
            <div className="pl-6 pr-2 text-zinc-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full bg-transparent px-6 py-5 text-lg text-foreground placeholder:text-zinc-500 focus:outline-none ${
              icon ? "pl-2" : ""
            } ${className}`}
            {...props}
          />
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -bottom-6 left-6 text-sm text-signal-red"
          >
            {error}
          </motion.p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
