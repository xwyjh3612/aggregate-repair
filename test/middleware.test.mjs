import test from "node:test"
import assert from "node:assert/strict"
import { onProvider, _internal } from "../middleware.mjs"

function payload() {
  return {
    model: "deepseek/example",
    previous_response_id: "resp_previous",
    input: [
      { id: "msg_01a18516-deadbeef", type: "message", role: "user", content: [{ type: "input_text", text: "hello" }] },
      { id: "rs_18e2dc5df258cdd400000105", type: "reasoning", summary: [], encrypted_content: "opaque" },
      { id: "fc_other", type: "function_call", call_id: "call_1", name: "shell", arguments: "{}" },
    ],
  }
}

test("cleans Responses item IDs before an upstream request", () => {
  const body = payload()
  const out = onProvider(body, {
    protocol: "responses",
    model: "deepseek/example",
    provider: { id: "relay-main", model: "deepseek/example" },
    options: { middleware: { enabled: true, providers: ["relay-main"], mode: "safe" } },
  })
  assert.ok(out)
  assert.equal(out.previous_response_id, "resp_previous")
  assert.deepEqual(out.input.map((item) => item.id), [undefined, undefined, undefined])
  assert.equal(out.input[0].content[0].text, "hello")
  assert.equal(out.input[1].encrypted_content, "opaque")
  assert.equal(out.input[2].call_id, "call_1")
  assert.equal(body.input[0].id, "msg_01a18516-deadbeef")
})

test("keeps the pointer when resume sends only the newest message", () => {
  const out = onProvider({
    previous_response_id: "resp_previous",
    input: [{ id: "msg_last", type: "message", role: "user", content: [{ type: "input_text", text: "last sentence" }] }],
  }, {
    protocol: "responses",
    provider: { id: "relay-main" },
    options: { middleware: { enabled: true, providers: ["relay-main"], mode: "safe" } },
  })
  assert.ok(out)
  assert.equal(out.previous_response_id, "resp_previous")
  assert.equal(out.input[0].id, undefined)
  assert.equal(out.input[0].content[0].text, "last sentence")
})

test("removes the pointer only when explicitly enabled and full history is visible", () => {
  const full = payload()
  full.input.unshift({ type: "message", role: "developer", content: [{ type: "input_text", text: "instructions" }] })
  const out = onProvider(full, {
    protocol: "responses",
    provider: { id: "relay-main" },
    options: { middleware: { enabled: true, providers: ["relay-main"], mode: "safe", stripPreviousResponseId: true } },
  })
  assert.ok(out)
  assert.equal(out.previous_response_id, undefined)
})

test("leaves other channels and protocols untouched", () => {
  const body = payload()
  assert.equal(onProvider(body, {
    protocol: "responses",
    provider: { id: "relay-other" },
    options: { middleware: { providers: ["relay-main"] } },
  }), undefined)
  assert.equal(onProvider(body, {
    protocol: "chat",
    provider: { id: "relay-main" },
    options: { middleware: { providers: ["relay-main"] } },
  }), undefined)
})

test("safe mode keeps unresolved item references", () => {
  const body = { input: [{ id: "msg_1", type: "message" }, { id: "msg_2", type: "item_reference" }] }
  assert.equal(onProvider(body, {
    protocol: "responses",
    provider: { id: "relay-main" },
    options: { middleware: { enabled: true, providers: ["relay-main"], mode: "safe" } },
  }), undefined)
})

test("aggressive mode can drop item references when explicitly enabled", () => {
  const out = onProvider({ previous_response_id: "resp_1", input: [{ id: "msg_2", type: "item_reference" }] }, {
    protocol: "responses",
    provider: { id: "relay-main" },
    options: { middleware: { enabled: true, providers: ["relay-main"], mode: "aggressive", dropItemReferences: true, stripPreviousResponseId: true } },
  })
  assert.ok(out)
  assert.deepEqual(out.input, [])
  assert.equal(out.previous_response_id, undefined)
})

test("channel and model patterns are supported", () => {
  assert.equal(_internal.patternMatches("relay-main-2", ["relay*"]), true)
  assert.equal(_internal.patternMatches("other", ["relay*"]), false)
  assert.ok(onProvider(payload(), {
    protocol: "responses",
    model: "deepseek/example",
    provider: { id: "relay-main-2" },
    options: { middleware: { providers: ["relay*"], models: ["deepseek/*"] } },
  }))
})

test("disabled middleware does nothing", () => {
  assert.equal(onProvider(payload(), {
    protocol: "responses",
    provider: { id: "relay-main" },
    options: { middleware: { enabled: false, providers: ["relay-main"] } },
  }), undefined)
})
