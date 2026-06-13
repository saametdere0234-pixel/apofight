'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Path {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  phase: number;
  speed: number;
}

interface DynamicBackgroundProps {
  mode: 'blurred' | 'sharp';
}

export function DynamicBackground({ mode }: DynamicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const colors = useMemo(() => [
    'rgba(249, 168, 212, 0.4)', // Pink
    'rgba(253, 230, 138, 0.4)', // Yellow
    'rgba(147, 197, 253, 0.4)', // Blue
    'rgba(253, 186, 116, 0.4)', // Orange
    'rgba(79, 209, 197, 0.4)',  // Teal
  ], []);

  const paths = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => ({
      color: colors[i % colors.length],
      width: 40 + Math.random() * 40,
      phase: Math.random() * Math.PI * 2,
      speed: 0.001 + Math.random() * 0.002,
      seed: Math.random() * 100
    }));
  }, [colors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Background base color (matching the image's light cream)
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      paths.forEach((path, i) => {
        ctx.beginPath();
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const t = time * path.speed;
        const startY = (canvas.height / (paths.length + 1)) * (i + 1);
        
        ctx.moveTo(-50, startY);

        for (let x = 0; x <= canvas.width + 100; x += 50) {
          const dy = Math.sin(x * 0.002 + t + path.phase) * 100 + 
                     Math.cos(x * 0.005 - t * 0.5 + path.seed) * 50;
          ctx.lineTo(x, startY + dy);
        }

        ctx.stroke();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [paths]);

  return (
    <div 
      className={cn(
        "fixed inset-0 -z-50 transition-all duration-1000 ease-in-out overflow-hidden pointer-events-none",
        mode === 'blurred' ? "blur-2xl brightness-50" : "blur-0 brightness-100"
      )}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
