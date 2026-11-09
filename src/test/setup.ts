import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock getComputedStyle for pseudo-elements
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = vi.fn((elt, pseudoElt) => {
  if (pseudoElt) {
    return originalGetComputedStyle(elt) as CSSStyleDeclaration;
  }
  return originalGetComputedStyle(elt) as CSSStyleDeclaration;
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.ResizeObserver = ResizeObserverMock;
