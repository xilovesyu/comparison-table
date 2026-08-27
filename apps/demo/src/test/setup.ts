import '@testing-library/jest-dom/vitest';
Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }) });
