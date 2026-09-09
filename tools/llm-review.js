/**
 * llm-review.js — optional LLM code-quality review for graded Karel problems.
 *
 * tools/grade.js calls reviewSolution() once per graded problem when the run is
 * given --llm-endpoint and --llm-model. It sends the problem statement, the
 * reference ("golden") solution, the submitted code (with grade.js's
 * problem_<n> framing already stripped), and the deterministic grader verdict to
 * an OpenAI-compatible chat endpoint (Ollama's /v1/chat/completions, or any
 * compatible gateway) and returns a prose critique in the instructor's voice.
 *
 * This is advisory only: the grade of record is still gradeKarel's verdict. Any
 * failure here (endpoint down, non-200, bad JSON, timeout) resolves to
 * { error } — the grading run must not be affected.
 *
 * Dependency-free: uses the Node global fetch / AbortController (Node ≥ 18).
 */

/** System prompt: the course instructor reflecting on code quality, in first person. */
export const SYSTEM_PROMPT = `I am the instructor for an introductory university CS course \
(CS 106A-style), and I am reviewing a submission to a Karel the Robot problem written in \
JavaScript. I have the problem statement, my reference ("golden") solution, the submitted code, \
and an automated correctness verdict.

The automated verdict already decides correctness and points — do not assign a grade or a score. \
Write in my voice as the instructor, addressing the author directly in the second person ("you"). \
Do not refer to "the student" or use any third-person framing. Ignore indentation and whitespace \
entirely — the submission pipeline reformats it, so it is never something to comment on.

Focus on the code-quality habits I want an undergraduate to build: decomposition into small \
well-named helper functions, avoiding repetition, choosing the right construct (loops and \
conditionals rather than copy-pasted straight-line code), clear and conventional naming, \
readability, useful comments, and idiomatic use of the Karel API. Compare the approach to the \
structure of my reference solution, but give full credit to correct approaches that differ from it.

Respond in 4–8 sentences, speaking to the author. Lead with what works well, then give the most \
valuable improvements, citing the author's own function and variable names. Do not rewrite the \
solution or paste large code blocks. If the submission is incorrect, you may note the likely \
conceptual gap, but keep the emphasis on quality and habits.

Write plain prose only. Do not use Markdown or any other markup: no headings, bold, italics, \
bullet or numbered lists, backticks, or code fences. Refer to code identifiers inline in plain \
text.`;

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
    "── Reference (golden) solution ──",
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
 * @param {{endpoint:string, model:string, token?:string, timeout?:number}} cfg
 * @param {{label:string, promptText:string, worldText:string,
 *          goldenSource:string, studentSource:string, verdict:string}} ctx
 * @returns {Promise<{text:string}|{error:string}>}
 */
export async function reviewSolution(cfg, ctx) {
  const { endpoint, model, token, timeout = 60000 } = cfg;
  const url = resolveEndpoint(endpoint);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const resp = await fetch(url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage(ctx) },
        ],
      }),
    });
    if (!resp.ok) {
      const body = (await resp.text().catch(() => "")).trim().slice(0, 200);
      return { error: `${resp.status} ${resp.statusText}${body ? ` — ${body}` : ""}` };
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return { error: "empty response" };
    return { text };
  } catch (err) {
    return { error: err?.name === "AbortError" ? `timed out after ${timeout}ms` : (err?.message || String(err)) };
  } finally {
    clearTimeout(timer);
  }
}
