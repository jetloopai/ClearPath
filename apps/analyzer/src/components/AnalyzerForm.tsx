"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { useRouter } from "next/navigation";

export function AnalyzerForm() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    // Route to results page (stubbed for now)
    router.push(`/results?address=${encodeURIComponent(query)}`);
  };

  return (
    <motion.form 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      onSubmit={handleAnalyze} 
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      <Input
        type="text"
        placeholder="Enter property address..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        icon={<Search className="w-5 h-5" />}
        className="text-center md:text-left"
      />
      <div className="flex justify-center">
        <Button type="submit" variant="primary" magnetic>
          Analyze Deal
        </Button>
      </div>
    </motion.form>
  );
}
