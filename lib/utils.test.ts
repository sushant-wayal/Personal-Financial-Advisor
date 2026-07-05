import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('merges class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('handles conditional classes with clsx', () => {
      expect(cn('class1', { class2: true, class3: false })).toBe('class1 class2');
    });

    it('merges tailwind classes using tailwind-merge', () => {
      // bg-red-500 should be overridden by bg-blue-500
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
      
      // padding should be overridden
      expect(cn('p-4 p-2', 'p-8')).toBe('p-8');
    });

    it('handles complex combinations', () => {
      expect(cn(
        'text-sm',
        true && 'font-bold',
        false && 'text-red-500',
        'p-4',
        'p-2'
      )).toBe('text-sm font-bold p-2');
    });
  });
});
