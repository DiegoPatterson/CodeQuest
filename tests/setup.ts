// Jest setup file for VS Code extension testing
// Mock VS Code API since we can't run it in Jest environment

const vscode = {
  ExtensionContext: jest.fn(),
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, scheme: 'file', path })),
    parse: jest.fn()
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showInputBox: jest.fn(),
    registerWebviewViewProvider: jest.fn()
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  workspace: {
    onDidChangeTextDocument: jest.fn(),
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      update: jest.fn()
    }))
  },
  Disposable: {
    from: jest.fn()
  }
};

// Mock the vscode module
jest.mock('vscode', () => vscode, { virtual: true });

export { vscode };