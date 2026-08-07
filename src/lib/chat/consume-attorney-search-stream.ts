import type {
  AttorneySearchDoneEvent,
  AttorneySearchResponse,
  AttorneySearchStage,
  AttorneySearchStreamEvent,
} from 'src/lib/chat/attorney-search-types';

const STAGE_ORDER: AttorneySearchStage[] = ['reading', 'searching', 'evaluating', 'ranking'];

function isStage(value: unknown): value is AttorneySearchStage {
  return typeof value === 'string' && (STAGE_ORDER as string[]).includes(value);
}

/**
 * Consume a POST text/event-stream body from the attorney-search API.
 * Invokes onStage for each progress event; resolves with the done payload.
 */
export async function consumeAttorneySearchStream(
  body: ReadableStream<Uint8Array>,
  options: {
    signal?: AbortSignal;
    onStage: (stage: AttorneySearchStage) => void;
  }
): Promise<AttorneySearchResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let donePayload: AttorneySearchResponse | null = null;

  const abortRead = () => {
    void reader.cancel().catch(() => undefined);
  };
  options.signal?.addEventListener('abort', abortRead, { once: true });

  try {
    while (!donePayload) {
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const dataLine = part
          .split('\n')
          .map((l) => l.trimEnd())
          .find((l) => l.startsWith('data:'));
        if (!dataLine) continue;

        const raw = dataLine.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;

        let event: AttorneySearchStreamEvent | { stage: 'error'; error?: string };
        try {
          event = JSON.parse(raw) as AttorneySearchStreamEvent | { stage: 'error'; error?: string };
        } catch {
          continue;
        }

        if (event.stage === 'error') {
          throw new Error(
            (event as { error?: string }).error || 'Search failed. Please try again.'
          );
        }

        if (event.stage === 'done') {
          const d = event as AttorneySearchDoneEvent;
          const { stage: _stage, ...response } = d;
          donePayload = response;
          break;
        }

        if (isStage(event.stage)) {
          options.onStage(event.stage);
        }
      }
    }
  } finally {
    options.signal?.removeEventListener('abort', abortRead);
    reader.releaseLock();
  }

  if (!donePayload) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    throw new Error('Search ended before results arrived. Please try again.');
  }

  return donePayload;
}
