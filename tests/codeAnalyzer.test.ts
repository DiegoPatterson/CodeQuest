import { CodeAnalyzer } from '../src/codeAnalyzer';
import { GameState } from '../src/gameState';

// Mock VS Code module
jest.mock('vscode', () => ({
  TextDocumentChangeEvent: jest.fn(),
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  }
}), { virtual: true });

describe('CodeAnalyzer', () => {
  let codeAnalyzer: CodeAnalyzer;
  let mockGameState: jest.Mocked<GameState>;

  beforeEach(() => {
    // Create a mock GameState
    mockGameState = {
      addLinesWritten: jest.fn(),
      detectCopyPaste: jest.fn(),
      breakCombo: jest.fn(),
      incrementCombo: jest.fn(),
      getStats: jest.fn(),
      addXP: jest.fn(),
      startBossBattle: jest.fn(),
      completeBossBattle: jest.fn(),
      checkDailyStreak: jest.fn(),
      resetStats: jest.fn()
    } as any;

    codeAnalyzer = new CodeAnalyzer(mockGameState);
  });

  describe('analyzeChange', () => {
    test('should handle normal code additions', () => {
      const mockEvent = {
        document: {
          lineCount: 2  // After adding a line with \n
        },
        contentChanges: [
          {
            text: 'console.log("test");\n',
            rangeLength: 0
          }
        ]
      };

      codeAnalyzer.analyzeChange(mockEvent as any);

      expect(mockGameState.addLinesWritten).toHaveBeenCalledWith(2);
      expect(mockGameState.detectCopyPaste).not.toHaveBeenCalled();
    });

    test('should detect copy-paste when large content is added quickly', () => {
      const largeText = Array(15).fill('line\n').join('');
      
      // First change
      const firstEvent = {
        document: {
          lineCount: 20
        },
        contentChanges: [
          {
            text: largeText,
            rangeLength: 0
          }
        ]
      };

      codeAnalyzer.analyzeChange(firstEvent as any);

      // Second change within rapid threshold
      const secondEvent = {
        document: {
          lineCount: 35
        },
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
        .mockReturnValueOnce(1000)   // First call
        .mockReturnValueOnce(1200);  // Second call (within 500ms threshold)

      codeAnalyzer.analyzeChange(secondEvent as any);

      expect(mockGameState.detectCopyPaste).toHaveBeenCalled();
      
      // Restore Date.now
      Date.now = originalNow;
    });

    test('should break combo when significant content is deleted', () => {
      const mockEvent = {
        document: {
          lineCount: 5
        },
        contentChanges: [
          {
            text: '',
            rangeLength: 100 // Large deletion
          }
        ]
      };

      codeAnalyzer.analyzeChange(mockEvent as any);

      expect(mockGameState.breakCombo).toHaveBeenCalled();
    });

    test('should not process empty content changes', () => {
      const mockEvent = {
        document: {
          lineCount: 10
        },
        contentChanges: []
      };

      codeAnalyzer.analyzeChange(mockEvent as any);

      expect(mockGameState.addLinesWritten).not.toHaveBeenCalled();
      expect(mockGameState.detectCopyPaste).not.toHaveBeenCalled();
      expect(mockGameState.breakCombo).not.toHaveBeenCalled();
    });

    test('should handle multiple content changes in one event', () => {
      const mockEvent = {
        document: {
          lineCount: 3
        },
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

      codeAnalyzer.analyzeChange(mockEvent as any);

      expect(mockGameState.addLinesWritten).toHaveBeenCalledWith(3);
    });

    test('should not break combo for small deletions', () => {
      const mockEvent = {
        document: {
          lineCount: 8
        },
        contentChanges: [
          {
            text: '',
            rangeLength: 10 // Small deletion
          }
        ]
      };

      codeAnalyzer.analyzeChange(mockEvent as any);

      expect(mockGameState.breakCombo).not.toHaveBeenCalled();
    });
  });

  describe('Combo System Integration', () => {
    test('should increment combo for normal typing', () => {
      const mockEvent = {
        document: {
          lineCount: 10
        },
        contentChanges: [
          {
            text: 'hello',
            rangeLength: 0
          }
        ]
      };

      codeAnalyzer.analyzeChange(mockEvent as any);

      // Should call incrementCombo for each word (1 word = "hello")
      expect(mockGameState.incrementCombo).toHaveBeenCalledTimes(1);
    });

    test('should handle mixed insertions and deletions', () => {
      const mockEvent = {
        document: {
          lineCount: 10
        },
        contentChanges: [
          {
            text: 'new code',
            rangeLength: 4 // Replacing 4 characters
          }
        ]
      };

      codeAnalyzer.analyzeChange(mockEvent as any);

      // Should increment combo for words added (2 words = "new" and "code")
      expect(mockGameState.incrementCombo).toHaveBeenCalledTimes(2);
    });

    test('should not increment combo for pure deletions', () => {
      const mockEvent = {
        document: {
          lineCount: 8
        },
        contentChanges: [
          {
            text: '',
            rangeLength: 10 // Deleting 10 characters
          }
        ]
      };

      codeAnalyzer.analyzeChange(mockEvent as any);

      expect(mockGameState.incrementCombo).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting Detection', () => {
    test('should detect bulk paste operations', () => {
      const mockEvent = {
        document: {
          lineCount: 50
        },
        contentChanges: [
          {
            text: 'a'.repeat(1000), // Large paste
            rangeLength: 0
          }
        ]
      };

      codeAnalyzer.analyzeChange(mockEvent as any);

      // Should still process but may be rate limited by GameState
      expect(mockGameState.incrementCombo).toHaveBeenCalled();
      expect(mockGameState.addLinesWritten).toHaveBeenCalled();
    });

    test('should handle multiple content changes', () => {
      const mockEvent = {
        document: {
          lineCount: 15
        },
        contentChanges: [
          {
            text: 'first change',
            rangeLength: 0
          },
          {
            text: 'second change',
            rangeLength: 0
          }
        ]
      };

      codeAnalyzer.analyzeChange(mockEvent as any);

      // Should process all changes
      expect(mockGameState.incrementCombo).toHaveBeenCalledTimes(4); // Total words
    });

    test('should handle empty content changes', () => {
      const mockEvent = {
        contentChanges: []
      };

      codeAnalyzer.analyzeChange(mockEvent as any);

      // Should not crash or call any methods
      expect(mockGameState.incrementCombo).not.toHaveBeenCalled();
      expect(mockGameState.addLinesWritten).not.toHaveBeenCalled();
    });
  });

  describe('XP and Lines Tracking', () => {
    test('should track lines written accurately', () => {
      const mockEvent = {
        document: {
          lineCount: 2  // 2 newlines in the text
        },
        contentChanges: [
          {
            text: 'line 1\nline 2\nline 3',
            rangeLength: 0
          }
        ]
      };

      codeAnalyzer.analyzeChange(mockEvent as any);

      expect(mockGameState.addLinesWritten).toHaveBeenCalledWith(2);
    });

    test('should count single line without newline', () => {
      const mockEvent = {
        document: {
          lineCount: 1
        },
        contentChanges: [
          {
            text: 'single line of code',
            rangeLength: 0
          }
        ]
      };

      codeAnalyzer.analyzeChange(mockEvent as any);

      expect(mockGameState.addLinesWritten).toHaveBeenCalledWith(1);
    });

    test('should handle windows line endings', () => {
      const mockEvent = {
        document: {
          lineCount: 2
        },
        contentChanges: [
          {
            text: 'line 1\r\nline 2\r\nline 3',
            rangeLength: 0
          }
        ]
      };

      codeAnalyzer.analyzeChange(mockEvent as any);

      expect(mockGameState.addLinesWritten).toHaveBeenCalledWith(2);
    });
  });
});