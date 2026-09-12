import "fake-indexeddb/auto";

const globalWindow = globalThis as typeof globalThis & {
  window?: {
    matchMedia?: (query: string) => unknown;
  };
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

if (
  globalWindow.window !== undefined &&
  globalWindow.window.matchMedia === undefined
) {
  globalWindow.window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
  globalWindow.IS_REACT_ACT_ENVIRONMENT = true;
}
