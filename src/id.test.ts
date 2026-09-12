import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "./id";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a valid v4 UUID when crypto.randomUUID is absent", () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    const spy = vi.fn((buffer: Uint8Array) => getRandomValues(buffer));
    vi.stubGlobal("crypto", { getRandomValues: spy });

    expect(crypto["randomUUID"]).toBeUndefined();
    const id = newId();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(id).toMatch(UUID_V4);
    expect(id[14]).toBe("4");
    expect(id[19]).toMatch(/[89ab]/);
  });

  it("uses crypto.randomUUID when the runtime provides it", () => {
    const expected = "12345678-1234-4234-8234-1234567890ab";
    const randomUUID = vi.fn(() => expected);
    vi.stubGlobal("crypto", {
      randomUUID,
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });

    expect(newId()).toBe(expected);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });
});
