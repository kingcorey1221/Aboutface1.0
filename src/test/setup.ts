import "@testing-library/jest-dom/vitest";

Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: () => "test-uuid",
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      if (array && "byteLength" in array) {
        const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        view.fill(1);
      }
      return array;
    },
  },
});
