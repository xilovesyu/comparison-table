import '@testing-library/jest-dom/vitest';

const getComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (element, pseudoElement) =>
  pseudoElement ? getComputedStyle(element) : getComputedStyle(element);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
