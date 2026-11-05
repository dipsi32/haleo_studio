// Claude behind the same call shape the edge functions already use.
//
// The functions were written against an OpenAI-style chat completions body
// (messages, tools, tool_choice, image_url parts). Rather than rewrite each
// prompt, aiFetch takes that same request, sends it to the Anthropic Messages
// API, and returns a Response whose JSON has the OpenAI shape the callers
// already read (choices[0].message.content / .tool_calls[0].function.arguments).
//
// Auth: the caller passes `Authorization: Bearer <ANTHROPIC_API_KEY>` as before;
// it is sent on as x-api-key. Nothing here logs or stores the key.
//
// Models: "smart" (or the old "pro" names) maps to ANTHROPIC_MODEL_SMART,
// everything else to ANTHROPIC_MODEL_FAST. Override either in the function secrets.
//
// Temperature is deliberately not forwarded: newer Claude models may not accept it,
// and these prompts are written to be steady without it.
//
// Forced tool use (tool_choice "required" or a named function) is not forced
// any more: current models reject tool_choice "tool"/"any" with a 400, which
// took down every AI feature on Nov 5, 2026. We send tool_choice "auto", tell
// the model in the system prompt which tool to answer with, and if it answers
// in plain JSON instead, turn that into the tool call the callers expect.

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_FAST = "claude-sonnet-5-5";
const DEFAULT_SMART = "claude-opus-5-5";
const DEFAULT_MAX_TOKENS = 4096;

type OpenAIPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type OpenAIMessage = { role: "system" | "user" | "assistant"; content: string | OpenAIPart[] };

type OpenAITool = { type: "function"; function: { name: string; description?: string; parameters?: unknown } };

export type ChatRequest = {
  model?: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  max_tokens?: number;
  // temperature and the rest are accepted and ignored.
  [k: string]: unknown;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const partToBlock = (part: OpenAIPart): Record<string, unknown> => {
  if (part.type === "text") return { type: "text", text: part.text };
  const url = part.image_url.url;
  const m = url.match(/^data:([^;,]+);base64,(.*)$/s);
  if (m) {
    const [, mediaType, data] = m;
    if (mediaType === "application/pdf") {
      return { type: "document", source: { type: "base64", media_type: mediaType, data } };
    }
    if (IMAGE_TYPES.has(mediaType)) {
      return { type: "image", source: { type: "base64", media_type: mediaType, data } };
    }
    throw new Error(`Unsupported attachment type: ${mediaType}`);
  }
  return { type: "image", source: { type: "url", url } };
};

export const pickModel = (requested: string | undefined, env: (k: string) => string | undefined): string => {
  const smart = env("ANTHROPIC_MODEL_SMART") || DEFAULT_SMART;
  const fast = env("ANTHROPIC_MODEL_FAST") || DEFAULT_FAST;
  if (requested && requested.startsWith("claude-")) return requested;
  return /smart|pro/i.test(requested ?? "") ? smart : fast;
};

/** The tool the caller insists on, if any: a named function, or the only tool when "required". */
export const forcedToolName = (req: ChatRequest): string | null => {
  const tc = req.tool_choice;
  if (!req.tools?.length) return null;
  if (tc && typeof tc === "object") return tc.function.name;
  if (tc === "required" && req.tools.length === 1) return req.tools[0].function.name;
  return null;
};

export const toAnthropicBody = (req: ChatRequest, env: (k: string) => string | undefined): Record<string, unknown> => {
  let system = req.messages
    .filter((m) => m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content : m.content.map((p) => (p.type === "text" ? p.text : "")).join("\n")))
    .join("\n\n");

  const messages = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : m.content.map(partToBlock),
    }));

  const body: Record<string, unknown> = {
    model: pickModel(req.model, env),
    max_tokens: req.max_tokens ?? DEFAULT_MAX_TOKENS,
    messages,
  };
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description ?? "",
      input_schema: t.function.parameters ?? { type: "object", properties: {} },
    }));
    const tc = req.tool_choice;
    const forced = forcedToolName(req);
    if (tc === "none") delete body.tools;
    else if (forced || tc === "required") {
      body.tool_choice = { type: "auto" };
      const ask = forced
        ? `Give your answer by calling the ${forced} tool exactly once. Do not answer in plain text.`
        : "Give your answer by calling one of the provided tools. Do not answer in plain text.";
      system = system ? `${system}\n\n${ask}` : ask;
    }
  }
  if (system) body.system = system;
  return body;
};

type AnthropicBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown };

/** The first JSON object in a reply, for a model that answered in text instead of calling the tool. */
const jsonIn = (text: string): unknown => {
  const t = text.replace(/```(?:json)?/gi, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
};

export const toChatResponse = (
  j: { id?: string; model?: string; content?: AnthropicBlock[]; stop_reason?: string; usage?: unknown },
  forcedTool: string | null = null,
) => {
  let blocks = j.content ?? [];
  if (forcedTool && !blocks.some((b) => b.type === "tool_use")) {
    const input = jsonIn(blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join(""));
    if (input && typeof input === "object") {
      blocks = [{ type: "tool_use", id: "from_text", name: forcedTool, input }];
      j = { ...j, stop_reason: "tool_use" };
    }
  }
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  const calls = blocks
    .filter((b) => b.type === "tool_use")
    .map((b) => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
  const finish = j.stop_reason === "tool_use" ? "tool_calls" : j.stop_reason === "max_tokens" ? "length" : "stop";
  return {
    id: j.id,
    model: j.model,
    choices: [
      {
        index: 0,
        finish_reason: finish,
        message: { role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) },
      },
    ],
    usage: j.usage,
  };
};

/**
 * Drop-in for the old gateway fetch. Pass the same init the gateway call used
 * (method, headers with `Authorization: Bearer <key>`, JSON body).
 */
export async function aiFetch(
  init: { headers?: Record<string, string>; body: string },
  opts: { fetchImpl?: typeof fetch; env?: (k: string) => string | undefined } = {},
): Promise<Response> {
  const env = opts.env ?? ((k: string) => (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(k));
  const doFetch = opts.fetchImpl ?? fetch;
  const key = (init.headers?.Authorization ?? init.headers?.authorization ?? "").replace(/^Bearer\s+/i, "") || env("ANTHROPIC_API_KEY") || "";

  let body: Record<string, unknown>;
  let forced: string | null = null;
  try {
    const req = JSON.parse(init.body) as ChatRequest;
    forced = forcedToolName(req);
    body = toAnthropicBody(req, env);
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: e instanceof Error ? e.message : "Bad request" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await doFetch(API_URL, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": API_VERSION, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return res;
  const out = toChatResponse(await res.json(), forced);
  return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } });
}
