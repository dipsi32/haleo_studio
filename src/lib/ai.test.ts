/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { aiFetch, pickModel, toAnthropicBody, toChatResponse, type ChatRequest } from "../../supabase/functions/_shared/ai";

const env = (k: string) => ({ ANTHROPIC_MODEL_FAST: undefined, ANTHROPIC_MODEL_SMART: undefined } as Record<string, string | undefined>)[k];

describe("pickModel", () => {
  it("maps the tiers and honours overrides", () => {
    expect(pickModel("fast", env)).toBe("claude-sonnet-5-5");
    expect(pickModel("smart", env)).toBe("claude-opus-5-5");
    expect(pickModel("google/gemini-2.5-pro", env)).toBe("claude-opus-5-5");
    expect(pickModel(undefined, env)).toBe("claude-sonnet-5-5");
    expect(pickModel("fast", (k) => (k === "ANTHROPIC_MODEL_FAST" ? "claude-haiku-5-5" : undefined))).toBe("claude-haiku-5-5");
    expect(pickModel("claude-haiku-5-5", env)).toBe("claude-haiku-5-5");
  });
});

describe("toAnthropicBody", () => {
  const req: ChatRequest = {
    model: "fast",
    max_tokens: 900,
    temperature: 0.3,
    messages: [
      { role: "system", content: "Be brief." },
      { role: "system", content: "Be kind." },
      {
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
          { type: "image_url", image_url: { url: "data:application/pdf;base64,BBBB" } },
          { type: "image_url", image_url: { url: "https://example.com/room.png" } },
        ],
      },
    ],
    tools: [{ type: "function", function: { name: "emit", description: "d", parameters: { type: "object", properties: { a: { type: "string" } } } } }],
    tool_choice: { type: "function", function: { name: "emit" } },
  };

  it("joins system messages and keeps the rest", () => {
    const b = toAnthropicBody(req, env) as Record<string, any>;
    expect(b.system).toBe("Be brief.\n\nBe kind.");
    expect(b.messages).toHaveLength(1);
    expect(b.max_tokens).toBe(900);
    expect(b.model).toBe("claude-sonnet-5-5");
  });

  it("does not forward temperature", () => {
    expect(JSON.stringify(toAnthropicBody(req, env))).not.toMatch(/temperature/);
  });

  it("turns images, pdfs and urls into the right blocks", () => {
    const content = (toAnthropicBody(req, env) as any).messages[0].content;
    expect(content[0]).toEqual({ type: "text", text: "What is this?" });
    expect(content[1]).toEqual({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } });
    expect(content[2]).toEqual({ type: "document", source: { type: "base64", media_type: "application/pdf", data: "BBBB" } });
    expect(content[3]).toEqual({ type: "image", source: { type: "url", url: "https://example.com/room.png" } });
  });

  it("maps tools and a forced tool choice", () => {
    const b = toAnthropicBody(req, env) as any;
    expect(b.tools).toEqual([{ name: "emit", description: "d", input_schema: { type: "object", properties: { a: { type: "string" } } } }]);
    expect(b.tool_choice).toEqual({ type: "tool", name: "emit" });
  });

  it("defaults max_tokens and rejects unknown attachment types", () => {
    expect((toAnthropicBody({ messages: [{ role: "user", content: "hi" }] }, env) as any).max_tokens).toBe(4096);
    expect(() => toAnthropicBody({ messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:video/mp4;base64,AA" } }] }] }, env)).toThrow(/Unsupported/);
  });
});

describe("toChatResponse", () => {
  it("returns text as message.content", () => {
    const r = toChatResponse({ content: [{ type: "text", text: "Hello " }, { type: "text", text: "there" }], stop_reason: "end_turn" });
    expect(r.choices[0].message.content).toBe("Hello there");
    expect(r.choices[0].finish_reason).toBe("stop");
    expect((r.choices[0].message as any).tool_calls).toBeUndefined();
  });

  it("returns tool use as OpenAI-style tool_calls with JSON string arguments", () => {
    const r = toChatResponse({ content: [{ type: "tool_use", id: "t1", name: "emit", input: { a: 1 } }], stop_reason: "tool_use" });
    const call = (r.choices[0].message as any).tool_calls[0];
    expect(call.function.name).toBe("emit");
    expect(JSON.parse(call.function.arguments)).toEqual({ a: 1 });
    expect(r.choices[0].finish_reason).toBe("tool_calls");
    expect(r.choices[0].message.content).toBeNull();
  });

  it("flags truncation", () => {
    expect(toChatResponse({ content: [{ type: "text", text: "x" }], stop_reason: "max_tokens" }).choices[0].finish_reason).toBe("length");
  });
});

describe("aiFetch", () => {
  it("sends the key as x-api-key and returns the old shape", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }), { status: 200 });
    }) as unknown as typeof fetch;
    const res = await aiFetch(
      { headers: { Authorization: "Bearer sk-test", "Content-Type": "application/json" }, body: JSON.stringify({ model: "fast", messages: [{ role: "user", content: "hi" }] }) },
      { fetchImpl, env },
    );
    expect(res.ok).toBe(true);
    expect((await res.json()).choices[0].message.content).toBe("ok");
    expect(seen!.url).toBe("https://api.anthropic.com/v1/messages");
    const h = seen!.init.headers as Record<string, string>;
    expect(h["x-api-key"]).toBe("sk-test");
    expect(h["anthropic-version"]).toBe("2023-06-01");
    expect(JSON.stringify(h)).not.toMatch(/Bearer/);
  });

  it("passes API errors through with their status", async () => {
    const fetchImpl = (async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    const res = await aiFetch({ headers: { Authorization: "Bearer k" }, body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) }, { fetchImpl, env });
    expect(res.status).toBe(429);
    expect(await res.text()).toBe("rate limited");
  });

  it("answers 400 for a body it cannot translate, without calling out", async () => {
    let called = false;
    const fetchImpl = (async () => { called = true; return new Response("{}"); }) as unknown as typeof fetch;
    const res = await aiFetch({ body: "not json" }, { fetchImpl, env });
    expect(res.status).toBe(400);
    expect(called).toBe(false);
  });
});
