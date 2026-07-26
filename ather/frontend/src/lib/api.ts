import type { CareerFormData, StartupFormData, ChatMessage } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export type SSEHandler = {
  onText: (chunk: string) => void;
  onEvent: (name: string, data: unknown) => void;
  onDone: () => void;
  onError: (msg: string) => void;
};

/**
 * Generic SSE stream consumer.
 * Handles both plain `data:` text events and named `event:` / `data:` pairs.
 * Returns an abort function.
 */
async function consumeSSE(
  url: string,
  body: unknown,
  handlers: SSEHandler
): Promise<() => void> {
  const controller = new AbortController();

  try {
    const res = await fetch(`${BASE}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = `Server error ${res.status}`;
      try {
        const j = await res.json();
        detail = j.detail || j.message || detail;
      } catch { /* ignore */ }
      handlers.onError(detail);
      return () => {};
    }

    if (!res.body) {
      handlers.onError("No response body");
      return () => {};
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { handlers.onDone(); break; }

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          if (!block.trim()) continue;

          let eventName: string | undefined;
          const dataLines: string[] = [];

          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) {
              eventName = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataLines.push(line.slice(6));
            }
          }

          const dataStr = dataLines.join("\n");
          if (!dataStr) continue;

          if (eventName === "done") {
            handlers.onDone();
            return;
          }

          if (eventName === "error") {
            try {
              const parsed = JSON.parse(dataStr);
              handlers.onError(parsed.message || "Unknown error");
            } catch {
              handlers.onError(dataStr);
            }
            return;
          }

          if (eventName) {
            // Named event — parse JSON and forward
            try {
              handlers.onEvent(eventName, JSON.parse(dataStr));
            } catch {
              handlers.onEvent(eventName, dataStr);
            }
          } else {
            // Plain text token
            handlers.onText(dataStr);
          }
        }
      }
    };

    pump().catch((err) => {
      if (err.name === "AbortError") return;
      handlers.onError(err.message || "Stream error");
    });

  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return () => {};
    handlers.onError(err instanceof Error ? err.message : "Network error");
  }

  return () => controller.abort();
}

export function streamCareerEval(data: CareerFormData, handlers: SSEHandler) {
  return consumeSSE("/api/career-evaluate", data, handlers);
}

export function streamStartupEval(data: StartupFormData, handlers: SSEHandler) {
  return consumeSSE("/api/business-evaluate", data, handlers);
}

export function streamChat(
  messages: ChatMessage[],
  mode: string,
  handlers: SSEHandler
) {
  const payload = {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    mode,
  };
  return consumeSSE("/api/chat", payload, handlers);
}

export async function checkHealth() {
  try {
    const res = await fetch(`${BASE}/api/health`);
    return res.ok ? await res.jsonf) : null;
  } catch {
    return null;
  }
}
