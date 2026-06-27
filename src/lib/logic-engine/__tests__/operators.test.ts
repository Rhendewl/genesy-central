import { describe, it, expect } from "vitest";
import { OPERATOR_REGISTRY, isRegexSafe } from "../operators";

// ── Helper ────────────────────────────────────────────────────────────────────

const op = OPERATOR_REGISTRY;

// ── equals / not_equals ───────────────────────────────────────────────────────

describe("equals", () => {
  it("matches identical strings", ()          => { expect(op.equals("hello", "hello")).toBe(true);  });
  it("is case-insensitive",    ()             => { expect(op.equals("Hello", "hello")).toBe(true);  });
  it("does not match different strings", ()   => { expect(op.equals("hello", "world")).toBe(false); });
  it("coerces numbers to strings", ()         => { expect(op.equals(42, "42")).toBe(true);           });
  it("treats null as empty string", ()        => { expect(op.equals(null, "")).toBe(true);           });
});

describe("not_equals", () => {
  it("returns true for different values", ()  => { expect(op.not_equals("a", "b")).toBe(true);      });
  it("returns false for equal values", ()     => { expect(op.not_equals("a", "a")).toBe(false);     });
  it("is case-insensitive", ()               => { expect(op.not_equals("A", "a")).toBe(false);     });
});

// ── contains / not_contains ───────────────────────────────────────────────────

describe("contains", () => {
  it("finds a substring", ()                  => { expect(op.contains("hello world", "world")).toBe(true);  });
  it("is case-insensitive", ()               => { expect(op.contains("Hello", "hello")).toBe(true);        });
  it("returns false when not found", ()       => { expect(op.contains("hello", "xyz")).toBe(false);         });
  it("matches empty string in any string", () => { expect(op.contains("abc", "")).toBe(true);               });
});

describe("not_contains", () => {
  it("returns true when not found", ()        => { expect(op.not_contains("hello", "xyz")).toBe(true);      });
  it("returns false when found", ()           => { expect(op.not_contains("hello world", "world")).toBe(false); });
});

// ── starts_with / ends_with ───────────────────────────────────────────────────

describe("starts_with", () => {
  it("matches prefix", ()                     => { expect(op.starts_with("hello world", "hello")).toBe(true);  });
  it("is case-insensitive", ()               => { expect(op.starts_with("Hello", "hello")).toBe(true);        });
  it("returns false for non-prefix", ()       => { expect(op.starts_with("world hello", "hello")).toBe(false); });
});

describe("ends_with", () => {
  it("matches suffix", ()                     => { expect(op.ends_with("hello world", "world")).toBe(true);   });
  it("is case-insensitive", ()               => { expect(op.ends_with("Hello World", "world")).toBe(true);   });
  it("returns false for non-suffix", ()       => { expect(op.ends_with("world hello", "world")).toBe(false);  });
});

// ── regex ─────────────────────────────────────────────────────────────────────

describe("regex", () => {
  it("matches a valid regex pattern",    ()  => { expect(op.regex("hello@example.com", "[a-z]+@[a-z]+\\.com")).toBe(true);  });
  it("returns false for no match",       ()  => { expect(op.regex("hello", "\\d+")).toBe(false);                             });
  it("is case-insensitive (flag i)",     ()  => { expect(op.regex("HELLO", "hello")).toBe(true);                             });
  it("returns false when value is not a string", () => { expect(op.regex("test", 123)).toBe(false);                          });
  it("returns false for invalid regex",  ()  => { expect(op.regex("test", "[invalid")).toBe(false);                          });
});

// ── empty / not_empty ─────────────────────────────────────────────────────────

describe("empty", () => {
  it("null is empty", ()                     => { expect(op.empty(null, undefined)).toBe(true);    });
  it("undefined is empty", ()               => { expect(op.empty(undefined, undefined)).toBe(true); });
  it("empty string is empty", ()            => { expect(op.empty("", undefined)).toBe(true);        });
  it("whitespace-only string is empty", ()  => { expect(op.empty("   ", undefined)).toBe(true);     });
  it("empty array is empty", ()             => { expect(op.empty([], undefined)).toBe(true);         });
  it("non-empty string is not empty", ()    => { expect(op.empty("hello", undefined)).toBe(false);  });
  it("non-empty array is not empty", ()     => { expect(op.empty([1, 2], undefined)).toBe(false);   });
  it("zero is not empty", ()                => { expect(op.empty(0, undefined)).toBe(false);        });
});

describe("not_empty", () => {
  it("non-empty string is not_empty", ()    => { expect(op.not_empty("hello", undefined)).toBe(true);  });
  it("null is not not_empty", ()            => { expect(op.not_empty(null, undefined)).toBe(false);    });
  it("empty string is not not_empty", ()    => { expect(op.not_empty("", undefined)).toBe(false);      });
});

// ── greater_than / less_than ──────────────────────────────────────────────────

describe("greater_than", () => {
  it("10 > 5", ()                            => { expect(op.greater_than(10, 5)).toBe(true);           });
  it("5 > 10 is false", ()                   => { expect(op.greater_than(5, 10)).toBe(false);          });
  it("5 > 5 is false", ()                    => { expect(op.greater_than(5, 5)).toBe(false);           });
  it("works with numeric strings", ()        => { expect(op.greater_than("10", "5")).toBe(true);        });
  it("NaN answer returns false", ()          => { expect(op.greater_than("abc", 5)).toBe(false);       });
});

describe("less_than", () => {
  it("5 < 10", ()                            => { expect(op.less_than(5, 10)).toBe(true);              });
  it("10 < 5 is false", ()                   => { expect(op.less_than(10, 5)).toBe(false);             });
  it("5 < 5 is false", ()                    => { expect(op.less_than(5, 5)).toBe(false);              });
});

// ── greater_or_equal / less_or_equal ─────────────────────────────────────────

describe("greater_or_equal", () => {
  it("10 >= 10", ()                          => { expect(op.greater_or_equal(10, 10)).toBe(true);      });
  it("11 >= 10", ()                          => { expect(op.greater_or_equal(11, 10)).toBe(true);      });
  it("9 >= 10 is false", ()                  => { expect(op.greater_or_equal(9, 10)).toBe(false);      });
});

describe("less_or_equal", () => {
  it("5 <= 5", ()                            => { expect(op.less_or_equal(5, 5)).toBe(true);           });
  it("4 <= 5", ()                            => { expect(op.less_or_equal(4, 5)).toBe(true);           });
  it("6 <= 5 is false", ()                   => { expect(op.less_or_equal(6, 5)).toBe(false);          });
});

// ── between ───────────────────────────────────────────────────────────────────

describe("between", () => {
  it("5 is between [1, 10] (array)", ()     => { expect(op.between(5, [1, 10])).toBe(true);            });
  it("1 is between [1, 10] (inclusive)", () => { expect(op.between(1, [1, 10])).toBe(true);            });
  it("10 is between [1, 10] (inclusive)", ()=> { expect(op.between(10, [1, 10])).toBe(true);           });
  it("0 is not between [1, 10]", ()         => { expect(op.between(0, [1, 10])).toBe(false);           });
  it("11 is not between [1, 10]", ()        => { expect(op.between(11, [1, 10])).toBe(false);          });
  it("works with string range '1,10'", ()   => { expect(op.between(5, "1,10")).toBe(true);             });
  it("NaN answer returns false", ()         => { expect(op.between("abc", [1, 10])).toBe(false);       });
});

// ── in / not_in ───────────────────────────────────────────────────────────────

describe("in", () => {
  it("value is in array", ()               => { expect(op.in("apple", ["apple", "banana"])).toBe(true);  });
  it("value not in array is false", ()     => { expect(op.in("mango", ["apple", "banana"])).toBe(false); });
  it("is case-insensitive", ()             => { expect(op.in("Apple", ["apple"])).toBe(true);             });
  it("works with comma-separated string", ()=>{ expect(op.in("a", "a,b,c")).toBe(true);                   });
  it("trims whitespace from list", ()      => { expect(op.in("a", "a, b, c")).toBe(true);                 });
});

describe("not_in", () => {
  it("value not in list", ()               => { expect(op.not_in("mango", ["apple", "banana"])).toBe(true);  });
  it("value in list is false", ()          => { expect(op.not_in("apple", ["apple", "banana"])).toBe(false); });
});

// ── isRegexSafe ───────────────────────────────────────────────────────────────

describe("isRegexSafe()", () => {
  it("safe pattern: simple character class", ()  => { expect(isRegexSafe("[a-z]+")).toBe(true);    });
  it("safe pattern: digits", ()                  => { expect(isRegexSafe("\\d+")).toBe(true);      });
  it("unsafe: (a+)+", ()                         => { expect(isRegexSafe("(a+)+")).toBe(false);    });
  it("unsafe: (a|aa)+", ()                       => { expect(isRegexSafe("(a|aa)+")).toBe(false);  });
  it("unsafe: ([a-z]+)+", ()                     => { expect(isRegexSafe("([a-z]+)+")).toBe(false);});
});
