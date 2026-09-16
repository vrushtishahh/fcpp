// Ensure basic Node.js environment shims in Web Worker
if (typeof (self as any).process === 'undefined') {
  (self as any).process = {
    stdout: { write: () => {} },
    stderr: { write: () => {} },
    env: {}
  };
}

// Global unhandled error handlers for the worker
self.onerror = (msg, url, line, col, error) => {
  const errorObj = {
    type: 'error',
    name: error?.name || 'WorkerGlobalError',
    message: String(msg || error?.message || 'Uncaught error in worker script'),
    stack: error?.stack || `Location: ${url || 'worker'}:${line}:${col}`,
    error: `Worker Error:\nName: ${error?.name || 'WorkerGlobalError'}\nMessage: ${String(msg || error?.message || 'Uncaught error in worker script')}\nStack: ${error?.stack || `Location: ${url || 'worker'}:${line}:${col}`}`
  };
  console.error('[Worker Global Uncaught Error]', errorObj);
  self.postMessage(errorObj);
};

self.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const reason = event.reason;
  const errorObj = {
    type: 'error',
    name: reason?.name || 'UnhandledPromiseRejection',
    message: String(reason?.message || reason || 'Unhandled promise rejection'),
    stack: reason?.stack || 'No stack trace available',
    error: `Worker Error:\nName: ${reason?.name || 'UnhandledPromiseRejection'}\nMessage: ${String(reason?.message || reason || 'Unhandled promise rejection')}\nStack: ${reason?.stack || 'No stack trace available'}`
  };
  console.error('[Worker Unhandled Promise Rejection]', errorObj);
  self.postMessage(errorObj);
};

// @ts-ignore
import * as JSCPPModule from 'JSCPP';
// @ts-ignore
import JSCPPDefault from 'JSCPP';

/**
 * Robustly resolve the JSCPP execution function and namespace.
 * Handles differences across CommonJS, Vite dev, Rollup production bundles, and Vercel.
 */
function getJSCPPRuntime() {
  const candidates = [
    JSCPPDefault,
    (JSCPPDefault as any)?.default,
    (JSCPPDefault as any)?.default?.default,
    JSCPPModule,
    (JSCPPModule as any)?.default,
    (JSCPPModule as any)?.default?.default
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate.run === 'function') {
      return {
        run: candidate.run.bind(candidate),
        includes: candidate.includes
      };
    }
  }

  // If candidate itself is a callable function
  for (const candidate of candidates) {
    if (typeof candidate === 'function') {
      return {
        run: candidate,
        includes: (candidate as any).includes
      };
    }
  }

  return null;
}

self.onmessage = (e: MessageEvent) => {
  const { code, input } = e.data;
  let output = '';

  try {
    const runtime = getJSCPPRuntime();
    if (!runtime || typeof runtime.run !== 'function') {
      const defaultKeys = Object.keys(JSCPPDefault || {});
      const moduleKeys = Object.keys(JSCPPModule || {});
      const err = new Error(
        `JSCPP execution engine could not be resolved.\nDefault export keys: [${defaultKeys.join(', ')}]\nModule keys: [${moduleKeys.join(', ')}]`
      );
      err.name = 'JSCPPResolutionError';
      throw err;
    }

    let currentInput = input != null ? String(input) : '';
    const config = {
      stdio: {
        write: (s: string) => {
          output += s;
          self.postMessage({ type: 'stdout', text: s });
        },
        drain: () => {
          const buf = currentInput;
          currentInput = '';
          return buf;
        }
      },
      maxTimeout: 10000 // internal safety guard
    };

    const exitCode = runtime.run(code, input != null ? String(input) : '', config);
    self.postMessage({
      type: 'done',
      output,
      exitCode: typeof exitCode === 'number' ? exitCode : 0
    });
  } catch (err: any) {
    const errorName = err?.name || 'RuntimeError';
    const errorMessage = err?.message || String(err);
    const errorStack = err?.stack || 'No stack trace available';

    const formattedDiagnostic = `Worker Error:\nName: ${errorName}\nMessage: ${errorMessage}\nStack: ${errorStack}`;

    console.error('[Worker Execution Catch]', {
      name: errorName,
      message: errorMessage,
      stack: errorStack
    });

    self.postMessage({
      type: 'error',
      output,
      name: errorName,
      message: errorMessage,
      stack: errorStack,
      error: formattedDiagnostic
    });
  }
};
