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
});