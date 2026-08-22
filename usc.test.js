var assert = require("assert");
var USC = require("./usc.js");

assert.deepStrictEqual(USC.parseLine(""), { type: "empty" });
assert.deepStrictEqual(USC.parseLine("help"), { type: "help" });
assert.deepStrictEqual(USC.parseLine("clear"), { type: "clear" });
assert.deepStrictEqual(USC.parseLine("g"), {
  type: "usage",
  message: "usage: g <query>"
});
assert.deepStrictEqual(USC.parseLine("hello world"), {
  type: "search",
  engines: ["google", "bing", "baidu"],
  query: "hello world"
});
assert.deepStrictEqual(USC.parseLine("g 量子计算"), {
  type: "search",
  engines: ["google"],
  query: "量子计算"
});
assert.deepStrictEqual(USC.parseLine("b hello"), {
  type: "search",
  engines: ["bing"],
  query: "hello"
});
assert.deepStrictEqual(USC.parseLine("d hello"), {
  type: "search",
  engines: ["baidu"],
  query: "hello"
});
assert.deepStrictEqual(USC.parseLine("all g"), {
  type: "search",
  engines: ["google", "bing", "baidu"],
  query: "g"
});

assert.strictEqual(
  USC.ENGINES.google.searchUrl("hello world"),
  "https://www.google.com/search?q=hello%20world"
);
assert.strictEqual(
  USC.ENGINES.bing.searchUrl("hello"),
  "https://www.bing.com/search?q=hello"
);
assert.strictEqual(
  USC.ENGINES.baidu.searchUrl("量子"),
  "https://www.baidu.com/s?wd=%E9%87%8F%E5%AD%90"
);
assert.strictEqual(
  USC.ENGINES.google.suggestUrl("hello", "cb1"),
  "https://suggestqueries.google.com/complete/search?client=chrome&hl=zh-CN&q=hello&callback=cb1"
);
assert.ok(USC.ENGINES.bing.suggestUrl("hello", "cb1").indexOf("JsonCallback=cb1") !== -1);
assert.ok(USC.ENGINES.baidu.suggestUrl("hello", "cb1").indexOf("cb=cb1") !== -1);

assert.deepStrictEqual(
  USC.ENGINES.google.parseSuggest(["hello", ["hello", "hello kitty", "hello fresh"]]),
  ["hello", "hello kitty", "hello fresh"]
);
assert.deepStrictEqual(
  USC.ENGINES.baidu.parseSuggest({ q: "hello", s: ["hello", "hellotalk"] }),
  ["hello", "hellotalk"]
);

console.log("ok");
