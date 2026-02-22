import { describe, it, expect } from "vitest"
import { formatAvg, formatObp, formatSlg, formatOps, formatEra, formatIp } from "./formatStats"

describe("formatAvg", () => {
  it("returns --- for 0 at-bats", () => {
    expect(formatAvg(0, 0)).toBe("---")
  })

  it("formats typical batting average", () => {
    expect(formatAvg(1, 3)).toBe(".333")
  })

  it("formats .000", () => {
    expect(formatAvg(0, 3)).toBe(".000")
  })

  it("formats 1.000 for perfect batting", () => {
    expect(formatAvg(3, 3)).toBe("1.000")
  })

  it("formats .250", () => {
    expect(formatAvg(1, 4)).toBe(".250")
  })
})

describe("formatObp", () => {
  it("returns --- when denominator is 0", () => {
    expect(formatObp(0, 0, 0, 0, 0)).toBe("---")
  })

  it("calculates OBP correctly", () => {
    // 1 hit, 1 walk, 0 HBP, 3 AB, 0 SF → (1+1+0)/(3+1+0+0) = .500
    expect(formatObp(1, 1, 0, 3, 0)).toBe(".500")
  })

  it("includes HBP and SF in calculation", () => {
    // 2 hits, 1 walk, 1 HBP, 4 AB, 1 SF → (2+1+1)/(4+1+1+1) = 4/7 ≈ .571
    expect(formatObp(2, 1, 1, 4, 1)).toBe(".571")
  })
})

describe("formatSlg", () => {
  it("returns --- for 0 at-bats", () => {
    expect(formatSlg(0, 0)).toBe("---")
  })

  it("calculates SLG correctly", () => {
    // 5 total bases in 10 at-bats = .500
    expect(formatSlg(5, 10)).toBe(".500")
  })

  it("handles SLG >= 1.000", () => {
    // 5 total bases in 3 at-bats = 1.667
    expect(formatSlg(5, 3)).toBe("1.667")
  })
})

describe("formatOps", () => {
  it("returns --- when both denominators are 0", () => {
    expect(formatOps(0, 0, 0, 0, 0, 0)).toBe("---")
  })

  it("calculates OPS correctly", () => {
    // OBP: (3+1+0)/(10+1+0+0) = 4/11 ≈ .364
    // SLG: 5/10 = .500
    // OPS: .864
    expect(formatOps(3, 1, 0, 10, 0, 5)).toBe(".864")
  })
})

describe("formatEra", () => {
  it("returns --- for 0 outs", () => {
    expect(formatEra(0, 0)).toBe("---")
  })

  it("calculates ERA correctly", () => {
    // 3 earned runs in 27 outs (9 innings) = 3.00
    expect(formatEra(3, 27)).toBe("3.00")
  })

  it("calculates ERA for partial innings", () => {
    // 2 earned runs in 18 outs (6 innings) = 3.00
    expect(formatEra(2, 18)).toBe("3.00")
  })

  it("calculates 0.00 ERA", () => {
    expect(formatEra(0, 27)).toBe("0.00")
  })
})

describe("formatIp", () => {
  it("formats 0 outs", () => {
    expect(formatIp(0)).toBe("0.0")
  })

  it("formats full innings", () => {
    expect(formatIp(27)).toBe("9.0")
  })

  it("formats partial innings - 1 out", () => {
    expect(formatIp(19)).toBe("6.1")
  })

  it("formats partial innings - 2 outs", () => {
    expect(formatIp(20)).toBe("6.2")
  })
})
