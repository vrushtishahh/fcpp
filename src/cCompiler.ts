// @ts-ignore
import CWorker from './cWorker?worker';

export interface ExecutionResult {
  output: string;
  error?: string;
  exitCode?: number;
  durationMs: number;
}

export function runCCode(code: string, input: string = '', timeoutMs: number = 2500): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    let accumulatedOutput = '';
    let isFinished = false;

    let worker: Worker | null = null;
    try {
      worker = new CWorker();
    } catch (workerInitErr: any) {
      console.error('[Worker Constructor Error]', workerInitErr);
      try {
        worker = new Worker(new URL('./cWorker.ts', import.meta.url), { type: 'module' });
      } catch (fallbackErr: any) {
        console.error('[Worker Fallback Constructor Error]', fallbackErr);
        const name = workerInitErr?.name || 'WorkerInitError';
        const message = workerInitErr?.message || String(workerInitErr);
        const stack = workerInitErr?.stack || fallbackErr?.stack || 'No stack trace available';

        return resolve({
          output: '',
          error: `Worker Error:\nName: ${name}\nMessage: ${message}\nStack: ${stack}`,
          durationMs: 0
        });
      }
    }

    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        if (worker) {
          worker.terminate();
          worker = null;
        }
        resolve({
          output: accumulatedOutput,
          error: `Worker Error:\nName: TimeoutError\nMessage: Execution timed out after ${timeoutMs}ms (infinite loop prevented).\nStack: Timeout triggered by parent controller`,
          durationMs: Math.round(performance.now() - startTime),
        });
      }
    }, timeoutMs);

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'stdout') {
        accumulatedOutput += msg.text;
      } else if (msg.type === 'done') {
        if (!isFinished) {
          isFinished = true;
          clearTimeout(timer);
          if (worker) {
            worker.terminate();
            worker = null;
          }
          resolve({
            output: msg.output ?? accumulatedOutput,
            exitCode: msg.exitCode,
            durationMs: Math.round(performance.now() - startTime),
          });
        }
      } else if (msg.type === 'error') {
        console.error('[Worker Message Error Event]', {
          name: msg.name,
          message: msg.message,
          stack: msg.stack,
          full: msg
        });

        if (!isFinished) {
          isFinished = true;
          clearTimeout(timer);
          if (worker) {
            worker.terminate();
            worker = null;
          }

          const name = msg.name || 'WorkerRuntimeError';
          const message = msg.message || (typeof msg.error === 'string' ? msg.error : 'Unknown worker runtime error');
          const stack = msg.stack || 'No stack trace available';

          const formattedError = msg.error && msg.error.startsWith('Worker Error:\n')
            ? msg.error
            : `Worker Error:\nName: ${name}\nMessage: ${message}\nStack: ${stack}`;

          resolve({
            output: msg.output ?? accumulatedOutput,
            error: formattedError,
            durationMs: Math.round(performance.now() - startTime),
          });
        }
      }
    };

    worker.onerror = (err: ErrorEvent) => {
      console.error('[Worker onerror Caught in Main Thread]', {
        message: err.message,
        filename: err.filename,
        lineno: err.lineno,
        colno: err.colno,
        error: err.error,
        event: err
      });

      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        if (worker) {
          worker.terminate();
          worker = null;
        }

        const name = err.error?.name || 'WorkerErrorEvent';
        const msg = err.error?.message || err.message || 'Worker thread encountered an unhandled error or failed to load';
        const loc = err.filename ? `\nFile: ${err.filename}:${err.lineno}:${err.colno}` : '';
        const stack = err.error?.stack || `No stack trace available.${loc}`;

        const formattedDiagnostic = `Worker Error:\nName: ${name}\nMessage: ${msg}${loc}\nStack: ${stack}`;

        resolve({
          output: accumulatedOutput,
          error: formattedDiagnostic,
          durationMs: Math.round(performance.now() - startTime),
        });
      }
    };

    worker.onmessageerror = (err: MessageEvent) => {
      console.error('[Worker onmessageerror Caught in Main Thread]', err);

      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        if (worker) {
          worker.terminate();
          worker = null;
        }

        const formattedDiagnostic = `Worker Error:\nName: MessageDeserializationError\nMessage: The worker message could not be deserialized.\nStack: Triggered on worker.onmessageerror handler`;

        resolve({
          output: accumulatedOutput,
          error: formattedDiagnostic,
          durationMs: Math.round(performance.now() - startTime),
        });
      }
    };

    worker.postMessage({ code, input });
  });
}
