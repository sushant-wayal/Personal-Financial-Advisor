import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from './ThemeToggle';

// Mock the Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, 'aria-pressed': ariaPressed, 'aria-label': ariaLabel }: any) => (
    <button 
      onClick={onClick}
      aria-pressed={ariaPressed}
      aria-label={ariaLabel}
      data-testid="theme-toggle-btn"
    >
      {children}
    </button>
  ),
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Sun: () => <svg data-testid="sun-icon" />,
  Moon: () => <svg data-testid="moon-icon" />,
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    // Clean up DOM before each test
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('renders correctly with light theme initially', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByTestId('theme-toggle-btn');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-pressed', 'false');
    
    // Should display Moon icon for light theme
    expect(screen.getByTestId('moon-icon')).toBeInTheDocument();
  });

  it('renders correctly with dark theme initially if document has dark class', () => {
    document.documentElement.classList.add('dark');
    render(<ThemeToggle />);
    
    const button = screen.getByTestId('theme-toggle-btn');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    
    // Should display Sun icon for dark theme
    expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
  });

  it('toggles theme when clicked', () => {
    render(<ThemeToggle />);
    const button = screen.getByTestId('theme-toggle-btn');
    
    // Click to toggle to dark
    fireEvent.click(button);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    
    // Click again to toggle back to light
    fireEvent.click(button);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});
