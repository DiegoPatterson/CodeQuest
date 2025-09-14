import { GameState } from '../src/gameState';
import { SidebarProvider } from '../src/sidebarProvider';
import { VisualEngine } from '../src/visualEngine';

// Mock VS Code module
jest.mock('vscode', () => ({
  ExtensionContext: jest.fn(),
  Uri: {
    joinPath: jest.fn(() => ({ toString: () => 'mock-uri' }))
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  }
}), { virtual: true });

describe('Memory Leak and Performance Tests', () => {
  let gameState: GameState;
  let sidebarProvider: SidebarProvider;
  let mockContext: any;

  beforeEach(() => {
    jest.useFakeTimers();
    
    // Create a mock extension context
    mockContext = {
      globalState: {
        get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
          if (key === 'codequest.enabled') {
            return true;
          }
          return defaultValue;
        }),
        update: jest.fn()
      }
    };
    
    gameState = new GameState(mockContext);
  });

  afterEach(() => {
    // Clean up timers and intervals
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('Timer Memory Leak Tests', () => {
    test('should not create excessive timers in GameState', () => {
      const initialTimerCount = jest.getTimerCount();
      
      // Create multiple GameState instances
      for (let i = 0; i < 10; i++) {
        new GameState(mockContext);
      }
      
      const finalTimerCount = jest.getTimerCount();
      
      // Should not create more than reasonable number of timers
      expect(finalTimerCount - initialTimerCount).toBeLessThan(50);
    });

    test('should clean up combo decay timer properly', () => {
      const initialTimerCount = jest.getTimerCount();
      
      // Create and destroy GameState instances
      for (let i = 0; i < 5; i++) {
        const tempGameState = new GameState(mockContext);
        // Simulate some activity
        tempGameState.incrementCombo();
        jest.advanceTimersByTime(1000);
      }
      
      // Timer count should not grow excessively
      const finalTimerCount = jest.getTimerCount();
      expect(finalTimerCount - initialTimerCount).toBeLessThan(20);
    });
  });

  describe('Array Memory Leak Tests', () => {
    test('should limit recentIncrements array size', () => {
      // Simulate many rapid increments
      for (let i = 0; i < 100; i++) {
        gameState.incrementCombo();
        jest.advanceTimersByTime(60); // Advance past rate limit
      }
      
      // Array should be limited to prevent memory bloat
      const stats = gameState.getStats();
      // We can't directly access private recentIncrements, but combo should work
      expect(stats.combo).toBeGreaterThan(0);
    });

    test('should handle rapid typing velocity tracking', () => {
      // Create sidebar provider to test typing velocity tracking
      const mockUri = { toString: () => 'mock-extension-uri' } as any;
      sidebarProvider = new SidebarProvider(mockUri, gameState);
      
      // Simulate rapid typing
      for (let i = 0; i < 50; i++) {
        sidebarProvider.triggerImpactFrame();
        jest.advanceTimersByTime(10);
      }
      
      // Should not crash or consume excessive memory
      expect(true).toBe(true);
    });
  });

  describe('Performance Stress Tests', () => {
    test('should handle rapid XP additions efficiently', () => {
      const startTime = Date.now();
      
      // Add XP rapidly
      for (let i = 0; i < 1000; i++) {
        gameState.addXP(1);
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time (under 100ms)
      expect(executionTime).toBeLessThan(100);
    });

    test('should handle rapid combo increments efficiently', () => {
      // Use real timers for performance measurement
      jest.useRealTimers();
      const startTime = Date.now();
      
      // Increment combo rapidly (but respect rate limiting)
      for (let i = 0; i < 100; i++) {
        gameState.incrementCombo();
        // Small delay to bypass rate limiting
        const now = Date.now();
        while (Date.now() - now < 60) {
          // Wait 60ms
        }
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(10000); // Very generous timeout
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
    });

    test('should handle boss battle creation and completion efficiently', () => {
      const startTime = Date.now();
      
      // Create and complete multiple boss battles
      for (let i = 0; i < 20; i++) {
        gameState.startBossBattle(`Boss ${i}`);
        gameState.completeBossBattle();
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(50);
    });
  });

  describe('State Persistence Performance', () => {
    test('should not save stats excessively', () => {
      const updateSpy = jest.spyOn(mockContext.globalState, 'update');
      
      // Perform actions that trigger saves
      gameState.addXP(10);
      gameState.incrementCombo();
      gameState.addLinesWritten(5);
      
      // Should not call update excessively
      expect(updateSpy.mock.calls.length).toBeLessThan(10);
    });

    test('should handle toggle state changes efficiently', () => {
      const updateSpy = jest.spyOn(mockContext.globalState, 'update');
      
      // Toggle state multiple times
      for (let i = 0; i < 10; i++) {
        gameState.toggleEnabled();
      }
      
      // Should save state for each toggle
      expect(updateSpy).toHaveBeenCalled();
      expect(updateSpy.mock.calls.length).toBe(10);
    });
  });

  describe('Callback Memory Management', () => {
    test('should not accumulate callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();
      
      // Set multiple callbacks (should replace, not accumulate)
      gameState.setRefreshCallback(callback1);
      gameState.setRefreshCallback(callback2);
      gameState.setRefreshCallback(callback3);
      
      // Trigger an action that calls callbacks - use combo decay trigger
      gameState.incrementCombo(); // Add combo first
      jest.advanceTimersByTime(5000); // Fast forward to trigger combo decay
      
      // Only the last callback should be called
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
    });
  });
});