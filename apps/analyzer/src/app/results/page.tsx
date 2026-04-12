import { Suspense } from "react";
import ResultsView from "@/components/ResultsView";

export default function ResultsPage() {
  return (
    <main className="min-h-screen pt-20 md:pt-24 pb-12 px-4 md:px-6">
      <Suspense fallback={<div className="text-center text-zinc-500 mt-20">Analyzing Deal...</div>}>
        <ResultsView />
      </Suspense>
    </main>
  );
}
