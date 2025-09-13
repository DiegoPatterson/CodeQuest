"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codeAnalyzer_1 = require("../src/codeAnalyzer");
// Mock VS Code module
jest.mock('vscode', () => ({
    TextDocumentChangeEvent: jest.fn(),
    window: {
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn()
    }
}), { virtual: true });
describe('CodeAnalyzer', () => {
    let codeAnalyzer;
    let mockGameState;
    beforeEach(() => {
        // Create a mock GameState
        mockGameState = {
            addLinesWritten: jest.fn(),
            detectCopyPaste: jest.fn(),
            breakCombo: jest.fn(),
            getStats: jest.fn(),
            addXP: jest.fn(),
            startBossBattle: jest.fn(),
            completeBossBattle: jest.fn(),
            checkDailyStreak: jest.fn(),
            resetStats: jest.fn()
        };
        codeAnalyzer = new codeAnalyzer_1.CodeAnalyzer(mockGameState);
    });
    describe('analyzeChange', () => {
        test('should handle normal code additions', () => {
            const mockEvent = {
                contentChanges: [
                    {
                        text: 'console.log("test");\n',
                        rangeLength: 0
                    }
                ]
            };
            codeAnalyzer.analyzeChange(mockEvent);
            expect(mockGameState.addLinesWritten).toHaveBeenCalledWith(1);
            expect(mockGameState.detectCopyPaste).not.toHaveBeenCalled();
        });
        test('should detect copy-paste when large content is added quickly', () => {
            const largeText = Array(15).fill('line\n').join('');
            // First change
            const firstEvent = {
                contentChanges: [
                    {
                        text: largeText,
                        rangeLength: 0
                    }
                ]
            };
            codeAnalyzer.analyzeChange(firstEvent);
            // Second change within rapid threshold
            const secondEvent = {
                contentChanges: [
                    {
                        text: largeText,
                        rangeLength: 0
                    }
                ]
            };
            // Mock Date.now to simulate rapid changes
            const originalNow = Date.now;
            Date.now = jest.fn()
                .mockReturnValueOnce(1000) // First call
                .mockReturnValueOnce(1200); // Second call (within 500ms threshold)
            codeAnalyzer.analyzeChange(secondEvent);
            expect(mockGameState.detectCopyPaste).toHaveBeenCalled();
            // Restore Date.now
            Date.now = originalNow;
        });
        test('should break combo when significant content is deleted', () => {
            const mockEvent = {
                contentChanges: [
                    {
                        text: '',
                        rangeLength: 100 // Large deletion
                    }
                ]
            };
            codeAnalyzer.analyzeChange(mockEvent);
            expect(mockGameState.breakCombo).toHaveBeenCalled();
        });
        test('should not process empty content changes', () => {
            const mockEvent = {
                contentChanges: []
            };
            codeAnalyzer.analyzeChange(mockEvent);
            expect(mockGameState.addLinesWritten).not.toHaveBeenCalled();
            expect(mockGameState.detectCopyPaste).not.toHaveBeenCalled();
            expect(mockGameState.breakCombo).not.toHaveBeenCalled();
        });
        test('should handle multiple content changes in one event', () => {
            const mockEvent = {
                contentChanges: [
                    {
                        text: 'line 1\n',
                        rangeLength: 0
                    },
                    {
                        text: 'line 2\n',
                        rangeLength: 0
                    },
                    {
                        text: 'line 3\n',
                        rangeLength: 0
                    }
                ]
            };
            codeAnalyzer.analyzeChange(mockEvent);
            expect(mockGameState.addLinesWritten).toHaveBeenCalledWith(3);
        });
        test('should not break combo for small deletions', () => {
            const mockEvent = {
                contentChanges: [
                    {
                        text: '',
                        rangeLength: 10 // Small deletion
                    }
                ]
            };
            codeAnalyzer.analyzeChange(mockEvent);
            expect(mockGameState.breakCombo).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=codeAnalyzer.test.js.map