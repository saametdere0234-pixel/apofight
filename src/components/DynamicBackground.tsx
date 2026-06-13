'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface DynamicBackgroundProps {
  mode: 'blurred' | 'sharp';
}

export function DynamicBackground({ mode }: DynamicBackgroundProps) {
  return (
    <div 
      className={cn(
        "fixed inset-0 -z-50 transition-all duration-1000 ease-in-out overflow-hidden pointer-events-none bg-[#1a1a2e]",
        mode === 'blurred' ? "blur-2xl brightness-50" : "blur-0 brightness-100"
      )}
    >
      <div className="w-full h-full opacity-30 relative overflow-hidden">
        {/* Simple static curve patterns */}
        <div className="absolute top-1/4 left-0 w-full h-[100px] bg-pink-300/40 rounded-full blur-3xl rotate-6 -translate-x-10" />
        <div className="absolute top-2/4 right-0 w-full h-[120px] bg-blue-300/40 rounded-full blur-3xl -rotate-3 translate-x-10" />
        <div className="absolute top-3/4 left-1/4 w-[200%] h-[80px] bg-yellow-300/40 rounded-full blur-3xl rotate-12" />
      </div>
    </div>
  );
}
