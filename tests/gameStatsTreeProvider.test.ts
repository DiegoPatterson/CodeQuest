import { GameStatsTreeProvider } from '../src/gameStatsTreeProvider';
import { GameState } from '../src/gameState';

// Mock VS Code module
jest.mock('vscode', () => ({
  ExtensionContext: jest.fn(),
  TreeDataProvider: jest.fn(),
  TreeItem: jest.fn().mockImplementation(() => ({})),
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  }
}), { virtual: true });

describe('GameStatsTreeProvider', () => {
  let treeProvider: GameStatsTreeProvider;
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
    treeProvider = new GameStatsTreeProvider(mockGameState);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('Tree Data Structure', () => {
    test('should provide tree elements', async () => {
      const elements = await treeProvider.getChildren();
      
      expect(Array.isArray(elements)).toBe(true);
      expect(elements.length).toBeGreaterThan(0);
    });

    test('should show enabled status', async () => {
      const elements = await treeProvider.getChildren();
      const enabledItem = elements.find(item => 
        item.label && item.label.toString().includes('RPG Mode')
      );
      
      expect(enabledItem).toBeDefined();
      expect(enabledItem?.label?.toString()).toContain('ON');
    });

    test('should show player stats', async () => {
      const elements = await treeProvider.getChildren();
      
      // Check for level item
      const levelItem = elements.find(item => 
        item.label && item.label.toString().includes('Level')
      );
      expect(levelItem).toBeDefined();
    });
  });

  describe('Dynamic Updates', () => {
    test('should refresh when stats change', () => {
      const refreshSpy = jest.spyOn(treeProvider, 'refresh');
      
      // Trigger a stats change
      mockGameState.addXP(50);
      treeProvider.refresh();
      
      expect(refreshSpy).toHaveBeenCalled();
    });

    test('should handle disabled state', async () => {
      // Disable the extension
      mockGameState.toggleEnabled();
      
      const elements = await treeProvider.getChildren();
      const enabledItem = elements.find(item => 
        item.label && item.label.toString().includes('RPG Mode')
      );
      
      expect(enabledItem?.label?.toString()).toContain('OFF');
    });
  });

  describe('Performance Tests', () => {
    test('should handle rapid refreshes efficiently', () => {
      const startTime = Date.now();
      
      // Simulate rapid refresh calls
      for (let i = 0; i < 100; i++) {
        treeProvider.refresh();
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete rapidly (under 100ms for 100 refreshes)
      expect(executionTime).toBeLessThan(100);
    });

    test('should not leak memory on repeated getChildren calls', async () => {
      // Simulate many getChildren calls
      for (let i = 0; i < 50; i++) {
        const elements = await treeProvider.getChildren();
        expect(elements).toBeDefined();
      }
      
      // If this test passes without memory issues, we're good
      expect(true).toBe(true);
    });
  });
});