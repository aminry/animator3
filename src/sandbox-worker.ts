import { NodeVM } from 'vm2';
import * as ts from 'typescript';
import * as sdk from './index';

interface SandboxRequestMessage {
  code: string;
}

interface SandboxSuccessMessage {
  ok: true;
  json: unknown;
}

interface SandboxErrorMessage {
  ok: false;
  errorType: 'compile' | 'runtime' | 'timeout';
  message: string;
  stack?: string;
  diagnostics?: string[];
}

type SandboxWorkerResponse = SandboxSuccessMessage | SandboxErrorMessage;

function sendResponse(msg: SandboxWorkerResponse): void {
  if (typeof process.send === 'function') {
    process.send(msg);
  }
}

function handleRequest(message: SandboxRequestMessage): void {
  const { code } = message;

  try {
    const transpiled = ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        strict: true,
        esModuleInterop: true
      },
      reportDiagnostics: true
    });

    if (transpiled.diagnostics && transpiled.diagnostics.length > 0) {
      const diagnostics = transpiled.diagnostics.map(d =>
        ts.flattenDiagnosticMessageText(d.messageText, '\n')
      );

      sendResponse({
        ok: false,
        errorType: 'compile',
        message: 'TypeScript compilation failed',
        diagnostics
      });
      return;
    }

    const vm = new NodeVM({
      console: 'inherit',
      sandbox: {},
      require: {
        external: false,
        builtin: [],
        root: __dirname,
        mock: {
          '@motiongen/sdk': sdk
        }
      },
      wrapper: 'commonjs',
      timeout: 450
    });

    const moduleExports = vm.run(transpiled.outputText, 'user-code.js');
    let value: unknown = moduleExports;

    if (value && typeof value === 'object' && 'default' in (value as any)) {
      value = (value as any).default;
    }

    sendResponse({
      ok: true,
      json: value
    });
  } catch (error: any) {
    const messageText = error && typeof error.message === 'string' ? error.message : String(error);
    const isTimeout = /timed out/i.test(messageText);

    sendResponse({
      ok: false,
      errorType: isTimeout ? 'timeout' : 'runtime',
      message: messageText,
      stack: error && typeof error.stack === 'string' ? error.stack : undefined
    });
  } finally {
    process.exit(0);
  }
}

process.on('message', (message: SandboxRequestMessage) => {
  handleRequest(message);
});
