import { describe, expect, it } from "vitest";
import { conditionFromWmo } from "../src/weather";
import { api, body } from "./helpers";

describe("clima", () => {
  it("converte códigos WMO em condição visual", () => {
    expect(conditionFromWmo(0)).toBe("clear");
    expect(conditionFromWmo(3)).toBe("cloudy");
    expect(conditionFromWmo(45)).toBe("fog");
    expect(conditionFromWmo(61)).toBe("rain");
    expect(conditionFromWmo(81)).toBe("rain");
    expect(conditionFromWmo(73)).toBe("snow");
    expect(conditionFromWmo(95)).toBe("storm");
    expect(conditionFromWmo(-1)).toBe("unknown");
  });

  it("sem localização aproximada, responde 'unknown' sem chamar a previsão", async () => {
    const res = await api("/v1/weather");
    expect(await body(res)).toEqual({ condition: "unknown", is_day: null });
  });
});
