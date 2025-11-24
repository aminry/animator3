import { fork } from 'child_process';
import * as path from 'path';

export type SandboxErrorType = 'compile' | 'runtime' | 'timeout' | 'internal';

export interface SandboxSuccessResult {
  ok: true;
  json: unknown;
}

export interface SandboxErrorResult {
  ok: false;
  errorType: SandboxErrorType;
  message: string;
  stack?: string;
  diagnostics?: string[];
}

export type SandboxResult = SandboxSuccessResult | SandboxErrorResult;

interface WorkerMessageSuccess {
  ok: true;
  json: unknown;
}

interface WorkerMessageError {
  ok: false;
  errorType: 'compile' | 'runtime' | 'timeout';
  message: string;
  stack?: string;
  diagnostics?: string[];
}

type WorkerMessage = WorkerMessageSuccess | WorkerMessageError;

export function runSandbox(code: string, timeoutMs: number = 500): Promise<SandboxResult> {
  return new Promise(resolve => {
    const workerPath = path.join(__dirname, 'sandbox-worker.js');

    const child = fork(workerPath, {
      execArgv: ['--max-old-space-size=256'],
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    });

    let settled = false;

    const finish = (result: SandboxResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        ok: false,
        errorType: 'timeout',
        message: `Execution timed out after ${timeoutMs}ms`
      });
    }, timeoutMs);

    child.on('message', (message: WorkerMessage) => {
      clearTimeout(timer);

      if (message && typeof message === 'object' && 'ok' in message) {
        if (message.ok) {
          finish({ ok: true, json: message.json });
        } else {
          finish({
            ok: false,
            errorType: message.errorType,
            message: message.message,
            stack: message.stack,
            diagnostics: message.diagnostics
          });
        }
      } else {
        finish({
          ok: false,
          errorType: 'internal',
          message: 'Invalid response from sandbox worker'
        });
      }
    });

    child.on('error', error => {
      clearTimeout(timer);
      finish({
        ok: false,
        errorType: 'internal',
        message: String(error)
      });
    });

    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (!settled) {
        finish({
          ok: false,
          errorType: 'internal',
          message: `Sandbox worker exited unexpectedly (code=${code}, signal=${signal})`
        });
      }
    });

    child.send({ code });
  });
}
