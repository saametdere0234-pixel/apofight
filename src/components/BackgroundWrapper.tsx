'use client';

import { usePathname } from 'next/navigation';
import { DynamicBackground } from '@/components/DynamicBackground';

export function BackgroundWrapper() {
  const pathname = usePathname();
  // Check if we are in a game room
  const isGame = pathname?.startsWith('/game/');
  
  return <DynamicBackground mode={isGame ? 'sharp' : 'blurred'} />;
}
