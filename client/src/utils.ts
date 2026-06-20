import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Player } from '../../shared/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPlayerAvatarUrl(player: Player, defaultBg?: string): string {
  if (player.avatarBase64) return player.avatarBase64;
  const bg = defaultBg || (player.team === "red" ? "ef4444" : player.team === "blue" ? "3b82f6" : "64748b");
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${bg}`;
}
