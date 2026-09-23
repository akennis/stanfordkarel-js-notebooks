/**
 * llm-review.js — optional LLM code-quality review for graded Karel problems.
 *
 * tools/grade.js calls reviewSolution() once per graded problem when LLM review
 * is enabled. It sends the problem statement, the reference ("golden") solution,
 * the submitted code (with grade.js's problem_<n> framing already stripped), and
 * the deterministic grader verdict to one of two providers and returns a prose
 * critique in the instructor's voice:
 *
 *   provider "openai"    — any OpenAI-compatible chat-completions server
 *                          (Ollama's /v1/chat/completions, or a gateway).
 *                          Needs --llm-endpoint and --llm-model.
 *   provider "anthropic" — the Anthropic Messages API (POST /v1/messages).
 *                          The key is read from the ANTHROPIC_API_KEY_KAREL env var;
 *                          model defaults to claude-sonnet-5 and the endpoint to
 *                          https://api.anthropic.com (override with
 *                          --llm-endpoint to go through a proxy).
 *
 * This is advisory only: the grade of record is still gradeKarel's verdict. Any
 * failure here (endpoint down, non-200, bad JSON, timeout) resolves to
 * { error } — the grading run must not be affected.
 *
 * Dependency-free: both providers use the Node global fetch / AbortController
 * (Node ≥ 18). No SDK — grade.js must keep running without node_modules.
 */

/** System prompt: the course instructor reflecting on code quality, in first person. */
export const SYSTEM_PROMPT = `I am the instructor for an introductory university CS course \
(CS 106A-style), and I am reviewing a submission to a Karel the Robot problem written in \
JavaScript. I have the problem statement, my reference ("golden") solution, the submitted code, \
and an automated correctness verdict. The reference solution is for my eyes only: use it to \
understand what the problem requires, but never mention, quote, describe, or allude to it in \
your response. Do not say that a reference, golden, model, or instructor solution exists, and do \
not compare the submission to it or to any other program. Speak only to the quality of the \
submitted code with respect to the problem statement and good programming style and practice.

The automated verdict already decides correctness and points — do not assign a grade or a score. \
Write in my voice as the instructor, addressing the author directly in the second person ("you"). \
Do not refer to "the student" or use any third-person framing. Ignore indentation and whitespace \
entirely — the submission pipeline reformats it, so it is never something to comment on.

Focus on the code-quality habits I want an undergraduate to build: decomposition into small \
well-named helper functions, avoiding repetition, choosing the right construct (loops and \
conditionals rather than copy-pasted straight-line code), clear and conventional naming, \
readability, useful comments, and idiomatic use of the Karel API. Judge the approach on its own \
merits against the problem: any correct, well-structured approach deserves full credit, whatever \
shape it takes. One course convention to keep in mind: the robot arrives as the parameter of \
main (conventionally named k), and helper functions almost always receive the robot the same way, \
as a k parameter (for example function turnRight(k) { ... }, called as turnRight(k)). Karel is \
never kept in a global variable, so a helper that reaches for a global robot instead of taking k \
is worth flagging, and a helper that takes k is following the convention, not adding clutter.

Respond in 4–8 sentences, speaking to the author. Lead with what works well, then give the most \
valuable improvements, citing the author's own function and variable names. Do not rewrite the \
solution or paste large code blocks. If the submission is incorrect, you may note the likely \
conceptual gap, but keep the emphasis on quality and habits.

Write plain prose only. Do not use Markdown or any other markup: no headings, bold, italics, \
bullet or numbered lists, backticks, or code fences. Refer to code identifiers inline in plain \
text.`;

/** Defaults for the Anthropic provider. */
export const ANTHROPIC_DEFAULT_ENDPOINT = "https://api.anthropic.com";
export const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-5";
export const ANTHROPIC_API_VERSION = "2023-06-01";

/**
 * Resolve a user-supplied base URL to a chat-completions endpoint.
 *   http://localhost:11434            → http://localhost:11434/v1/chat/completions
 *   http://host/v1                    → http://host/v1/chat/completions
 *   http://host/v1/chat/completions   → unchanged
 * @param {string} base
 * @returns {string}
 */
export function resolveEndpoint(base) {
  const trimmed = String(base || "").replace(/\/+$/, "");
  if (/\/chat\/completions$/.test(trimmed)) return trimmed;
  if (/\/v1$/.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

/**
 * Resolve a user-supplied base URL to an Anthropic Messages endpoint.
 *   https://api.anthropic.com               → https://api.anthropic.com/v1/messages
 *   https://proxy/v1                        → https://proxy/v1/messages
 *   https://proxy/v1/messages               → unchanged
 * @param {string} base
 * @returns {string}
 */
export function resolveAnthropicEndpoint(base) {
  const trimmed = String(base || ANTHROPIC_DEFAULT_ENDPOINT).replace(/\/+$/, "");
  if (/\/v1\/messages$/.test(trimmed)) return trimmed;
  if (/\/v1$/.test(trimmed)) return `${trimmed}/messages`;
  return `${trimmed}/v1/messages`;
}

/** Build the user message from the grading context. */
function userMessage({ label, promptText, worldText, goldenSource, studentSource, verdict }) {
  return [
    `Problem: ${label}`,
    "",
    "── Problem statement ──",
    promptText || "(none provided)",
    "",
    "── World ──",
    worldText || "(none provided)",
    "",
    "── Reference (golden) solution (private — never mention or compare against it) ──",
    "```js",
    (goldenSource || "").trim(),
    "```",
    "",
    "── Submitted code ──",
    "```js",
    (studentSource || "").trim(),
    "```",
    "",
    "── Automated verdict ──",
    verdict || "(unknown)",
  ].join("\n");
}

/**
 * Ask the LLM to review one student solution.
 * @param {{provider?:"openai"|"anthropic", endpoint?:string, model?:string,
 *          token?:string, timeout?:number}} cfg
 *   provider "openai" (default) needs `endpoint` + `model`; `token` is an
 *   optional Bearer token. provider "anthropic" reads the key from `token` or,
 *   when that is absent, the ANTHROPIC_API_KEY_KAREL env var; `endpoint`/`model` fall
 *   back to ANTHROPIC_DEFAULT_ENDPOINT / ANTHROPIC_DEFAULT_MODEL.
 * @param {{label:string, promptText:string, worldText:string,
 *          goldenSource:string, studentSource:string, verdict:string}} ctx
 * @returns {Promise<{text:string}|{error:string}>}
 */
export async function reviewSolution(cfg, ctx) {
  const { provider = "openai", timeout = 60000 } = cfg;
  const req = provider === "anthropic" ? anthropicRequest(cfg, ctx) : openaiRequest(cfg, ctx);
  if (req.error) return { error: req.error };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      signal: controller.signal,
      body: JSON.stringify(req.body),
    });
    if (!resp.ok) {
      const body = (await resp.text().catch(() => "")).trim().slice(0, 200);
      return { error: `${resp.status} ${resp.statusText}${body ? ` — ${body}` : ""}` };
    }
    const data = await resp.json();
    return req.extract(data);
  } catch (err) {
    return { error: err?.name === "AbortError" ? `timed out after ${timeout}ms` : (err?.message || String(err)) };
  } finally {
    clearTimeout(timer);
  }
}

// OpenAI-compatible chat completions: { url, headers, body, extract } or { error }.
function openaiRequest({ endpoint, model, token }, ctx) {
  if (!endpoint || !model) return { error: "openai provider needs an endpoint and a model" };
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return {
    url: resolveEndpoint(endpoint),
    headers,
    body: {
      model,
      stream: false,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage(ctx) },
      ],
    },
    extract(data) {
      const text = data?.choices?.[0]?.message?.content?.trim();
      return text ? { text } : { error: "empty response" };
    },
  };
}

// Anthropic Messages API: { url, headers, body, extract } or { error }. The key
// comes from cfg.token or ANTHROPIC_API_KEY_KAREL; thinking is left at the model's
// default (adaptive on Claude 5 models), and the reply's text blocks are joined.
function anthropicRequest({ endpoint, model, token }, ctx) {
  const apiKey = token || process.env.ANTHROPIC_API_KEY_KAREL;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY_KAREL is not set (or pass --llm-token)" };
  return {
    url: resolveAnthropicEndpoint(endpoint),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
    },
    body: {
      model: model || ANTHROPIC_DEFAULT_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage(ctx) }],
    },
    extract(data) {
      if (data?.stop_reason === "refusal") {
        const why = data.stop_details?.explanation || data.stop_details?.category || "no reason given";
        return { error: `model refused — ${why}` };
      }
      const text = (Array.isArray(data?.content) ? data.content : [])
        .filter(b => b && b.type === "text" && typeof b.text === "string")
        .map(b => b.text).join("").trim();
      return text ? { text } : { error: "empty response" };
    },
  };
}
