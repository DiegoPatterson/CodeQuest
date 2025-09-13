import { GameState, PlayerStats, BossBattle } from '../src/gameState';

// Mock VS Code module
jest.mock('vscode', () => ({
  ExtensionContext: jest.fn(),
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  }
}), { virtual: true });

describe('GameState', () => {
  let gameState: GameState;
  let mockContext: any;

  beforeEach(() => {
    jest.useFakeTimers();
    // Create a mock extension context
    mockContext = {
      globalState: {
        get: jest.fn(),
        update: jest.fn()
      }
    };
    
    gameState = new GameState(mockContext);
  });

  afterEach(() => {
    // Clean up any mocks
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('Player Stats', () => {
    test('should initialize with default stats', () => {
      const stats = gameState.getStats();
      
      expect(stats.level).toBe(1);
      expect(stats.xp).toBe(0);
      expect(stats.xpToNextLevel).toBe(100);
      expect(stats.dailyStreak).toBe(0);
      expect(stats.totalLinesWritten).toBe(0);
      expect(stats.combo).toBe(0);
      expect(stats.maxCombo).toBe(0);
      expect(stats.bossBattlesWon).toBe(0);
    });

    test('should add XP correctly', () => {
      const initialStats = gameState.getStats();
      gameState.addXP(50);
      
      const updatedStats = gameState.getStats();
      expect(updatedStats.xp).toBe(initialStats.xp + 50);
    });

    test('should level up when XP threshold is reached', () => {
      // Add enough XP to level up
      gameState.addXP(100);
      
      const stats = gameState.getStats();
      expect(stats.level).toBe(2);
      expect(stats.xp).toBe(0); // XP should reset
      expect(stats.xpToNextLevel).toBe(150); // Should increase by 50%
    });

    test('should handle multiple level ups', () => {
      // Add enough XP for multiple levels
      gameState.addXP(300);
      
      const stats = gameState.getStats();
      expect(stats.level).toBeGreaterThan(1);
    });
  });

  describe('Boss Battles', () => {
    test('should start a boss battle', () => {
      const taskName = 'Test Boss Battle';
      gameState.startBossBattle(taskName);
      
      const stats = gameState.getStats();
      expect(stats.currentBossBattle).toBeDefined();
      expect(stats.currentBossBattle?.name).toBe(taskName);
      expect(stats.currentBossBattle?.completed).toBe(false);
    });

    test('should complete a boss battle', () => {
      gameState.startBossBattle('Test Battle');
      gameState.completeBossBattle();
      
      const stats = gameState.getStats();
      expect(stats.currentBossBattle).toBeUndefined();
      expect(stats.bossBattlesWon).toBe(1);
    });

    test('should award XP for completing boss battle', () => {
      const initialXP = gameState.getStats().xp;
      gameState.startBossBattle('Test Battle');
      gameState.completeBossBattle();
      
      const finalXP = gameState.getStats().xp;
      expect(finalXP).toBeGreaterThan(initialXP);
    });
  });

  describe('Daily Streak', () => {
    test('should check daily streak', () => {
      gameState.checkDailyStreak();
      
      const stats = gameState.getStats();
      const today = new Date().toDateString();
      expect(stats.lastActiveDate).toBe(today);
    });
  });

  describe('Reset Stats', () => {
    test('should reset all stats to default', () => {
      // Modify some stats first
      gameState.addXP(50);
      gameState.startBossBattle('Test');
      gameState.completeBossBattle();
      
      // Reset stats
      gameState.resetStats();
      
      const stats = gameState.getStats();
      expect(stats.level).toBe(1);
      expect(stats.xp).toBe(0);
      expect(stats.dailyStreak).toBe(0);
      expect(stats.totalLinesWritten).toBe(0);
      expect(stats.bossBattlesWon).toBe(0);
      expect(stats.currentBossBattle).toBeUndefined();
    });
  });

  describe('Wizard System', () => {
    test('should record wizard activity and start session', () => {
      expect(gameState.isWizardActive()).toBe(false);
      
      gameState.recordWizardActivity();
      
      expect(gameState.isWizardActive()).toBe(true);
      const wizardStats = gameState.getWizardStats();
      expect(wizardStats.totalSessions).toBe(1);
      expect(wizardStats.currentlyActive).toBe(true);
    });

    test('should maintain wizard session with continued activity', () => {
      gameState.recordWizardActivity();
      expect(gameState.isWizardActive()).toBe(true);
      
      // Record activity again within timeout period
      gameState.recordWizardActivity();
      
      // Should still be the same session
      const wizardStats = gameState.getWizardStats();
      expect(wizardStats.totalSessions).toBe(1);
      expect(wizardStats.currentlyActive).toBe(true);
    });

    test('should timeout wizard session after inactivity', async () => {
      gameState.recordWizardActivity();
      expect(gameState.isWizardActive()).toBe(true);
      
      // Mock the passage of time beyond timeout
      jest.advanceTimersByTime(6000); // 6 seconds > 5 second timeout
      
      expect(gameState.isWizardActive()).toBe(false);
    });

    test('should manually kill wizard session', () => {
      gameState.recordWizardActivity();
      expect(gameState.isWizardActive()).toBe(true);
      
      gameState.killWizardSession();
      
      expect(gameState.isWizardActive()).toBe(false);
      const wizardStats = gameState.getWizardStats();
      expect(wizardStats.currentlyActive).toBe(false);
    });

    test('should start new session after timeout', () => {
      gameState.recordWizardActivity();
      const firstSessionStats = gameState.getWizardStats();
      expect(firstSessionStats.totalSessions).toBe(1);
      
      // Simulate timeout
      jest.advanceTimersByTime(6000);
      expect(gameState.isWizardActive()).toBe(false);
      
      // Start new session
      gameState.recordWizardActivity();
      const secondSessionStats = gameState.getWizardStats();
      expect(secondSessionStats.totalSessions).toBe(2);
      expect(secondSessionStats.currentlyActive).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should rate limit combo increments', () => {
      const initialStats = gameState.getStats();
      const initialCombo = initialStats.combo;
      
      // Rapidly trigger combo increments
      gameState.incrementCombo();
      gameState.incrementCombo(); // This should be rate limited
      
      const stats = gameState.getStats();
      expect(stats.combo).toBe(initialCombo + 1); // Only one should go through
    });

    test('should allow combo increment after cooldown', () => {
      const initialStats = gameState.getStats();
      const initialCombo = initialStats.combo;
      
      gameState.incrementCombo();
      
      // Advance time past cooldown
      jest.advanceTimersByTime(100);
      
      gameState.incrementCombo();
      
      const stats = gameState.getStats();
      expect(stats.combo).toBe(initialCombo + 2); // Both should go through
    });

    test('should increase cooldown during bulk operations', () => {
      // Simulate rapid increments (bulk operation)
      for (let i = 0; i < 15; i++) {
        gameState.incrementCombo();
        jest.advanceTimersByTime(10); // Very fast typing
      }
      
      // The rate limiting should have kicked in and prevented some increments
      const stats = gameState.getStats();
      expect(stats.combo).toBeLessThan(15); // Should be less than all attempts
    });
  });

  describe('Callback System', () => {
    test('should set and call refresh callback', () => {
      const mockRefreshCallback = jest.fn();
      gameState.setRefreshCallback(mockRefreshCallback);
      
      // Build up combo first
      for (let i = 0; i < 10; i++) {
        gameState.incrementCombo();
        jest.advanceTimersByTime(500); // Space out the increments
      }
      
      // Reset mock to clear any calls from combo building
      mockRefreshCallback.mockClear();
      
      // Wait for combo decay to trigger (combo decay timer calls refresh)
      jest.advanceTimersByTime(5000); // 5 seconds of inactivity should trigger decay
      
      expect(mockRefreshCallback).toHaveBeenCalled();
    });

    test('should set and call multiplier callback', () => {
      const mockMultiplierCallback = jest.fn();
      gameState.setMultiplierCallback(mockMultiplierCallback);
      
      // Build up combo to trigger multiplier (space out increments to avoid rate limiting)
      for (let i = 0; i < 6; i++) {
        gameState.incrementCombo();
        jest.advanceTimersByTime(500); // Space out by 500ms to avoid rate limiting
      }
      
      expect(mockMultiplierCallback).toHaveBeenCalledWith(expect.any(Number));
    });

    test('should set and call impact frame callback', () => {
      const mockImpactFrameCallback = jest.fn();
      gameState.setImpactFrameCallback(mockImpactFrameCallback);
      
      gameState.incrementCombo();
      
      expect(mockImpactFrameCallback).toHaveBeenCalled();
    });
  });
});