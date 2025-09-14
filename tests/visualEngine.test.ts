import { VisualEngine } from '../src/visualEngine';
import { GameState } from '../src/gameState';

// Mock VS Code module
jest.mock('vscode', () => ({
  ExtensionContext: jest.fn(),
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  }
}), { virtual: true });

describe('VisualEngine', () => {
  let visualEngine: VisualEngine;
  let mockGameState: GameState;
  let mockContext: any;

  beforeEach(() => {
    jest.useFakeTimers();
    
    // Create a mock extension context
    mockContext = {
      globalState: {
        get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
          if (key === 'codequest.enabled') {
            return true; // Default enabled state
          }
          return defaultValue;
        }),
        update: jest.fn()
      }
    };
    
    mockGameState = new GameState(mockContext);
    visualEngine = new VisualEngine(mockGameState);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('Visual State Management', () => {
    test('should initialize with idle state', () => {
      const state = visualEngine.getVisualState();
      
      expect(state.playerState).toBe('idle');
      expect(state.wizardPresent).toBe(false);
      expect(state.useImages).toBe(true);
      expect(state.bossCheckpoints).toEqual([]);
    });

    test('should transition to fighting state when combo > 0', () => {
      // Add some combo to trigger fighting state
      mockGameState.incrementCombo();
      visualEngine.refreshVisualState();
      
      const state = visualEngine.getVisualState();
      expect(state.playerState).toBe('fighting');
    });

    test('should transition to boss battle state', () => {
      mockGameState.startBossBattle('Test Boss');
      visualEngine.refreshVisualState();
      
      const state = visualEngine.getVisualState();
      expect(state.playerState).toBe('boss_battle');
    });

    test('should show wizard when active', () => {
      mockGameState.recordWizardActivity();
      visualEngine.refreshVisualState();
      
      const state = visualEngine.getVisualState();
      expect(state.wizardPresent).toBe(true);
    });
  });

  describe('Performance and Memory', () => {
    test('should not create excessive objects in getVisualState', () => {
      const state1 = visualEngine.getVisualState();
      const state2 = visualEngine.getVisualState();
      
      // States should be separate objects but with same content
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });

    test('should handle rapid state changes efficiently', () => {
      // Simulate rapid state changes
      for (let i = 0; i < 100; i++) {
        mockGameState.incrementCombo();
        visualEngine.refreshVisualState();
        const state = visualEngine.getVisualState();
        expect(state).toBeDefined();
      }
    });
  });

  describe('Boss Battle Checkpoints', () => {
    test('should calculate boss checkpoints correctly', () => {
      mockGameState.startBossBattle('Test Boss');
      
      // Simulate progress
      const stats = mockGameState.getStats();
      if (stats.currentBossBattle) {
        stats.currentBossBattle.currentLines = 25;
        stats.currentBossBattle.targetLines = 100;
      }
      
      visualEngine.refreshVisualState();
      const state = visualEngine.getVisualState();
      
      expect(state.bossCheckpoints.length).toBeGreaterThan(0);
    });
  });
});