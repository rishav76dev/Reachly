import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function extractTweetId(input: string): string | null {
  const trimmed = input.trim();

  if (/^\d+$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/\/status\/(\d+)/);
  if (match?.[1]) return match[1];

  return null;
}
