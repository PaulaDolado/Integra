import { describe, expect, it } from "vitest";
import { formatIban, isValidIban, maskIban, normalizeIban } from "./iban";

describe("iban", () => {
  it("normaliza espacios y minúsculas", () => {
    expect(normalizeIban(" es91 2100 0418 4502 0005 1332 ")).toBe("ES9121000418450200051332");
  });

  it("valida el dígito de control", () => {
    expect(isValidIban("ES91 2100 0418 4502 0005 1332")).toBe(true);
    expect(isValidIban("ES92 2100 0418 4502 0005 1332")).toBe(false);
    expect(isValidIban("ES91 2100 0418 4502 0005 133")).toBe(false);
  });

  it("agrupa de 4 en 4 y enmascara todo menos el país y los 4 últimos", () => {
    expect(formatIban("ES9121000418450200051332")).toBe("ES91 2100 0418 4502 0005 1332");
    expect(maskIban("ES9121000418450200051332")).toBe("ES•• •••• •••• •••• •••• 1332");
  });
});
