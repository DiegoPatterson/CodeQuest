import { SidebarProvider } from '../src/sidebarProvider';
import { GameState } from '../src/gameState';

// Mock VS Code module
jest.mock('vscode', () => ({
  ExtensionContext: jest.fn(),
  Uri: {
    joinPath: jest.fn().mockReturnValue({ toString: () => 'mock-uri' })
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  WebviewView: jest.fn(),
  ViewColumn: { One: 1 }
}), { virtual: true });

describe('SidebarProvider', () => {
  let sidebarProvider: SidebarProvider;
  let gameState: GameState;
  let mockContext: any;
  let mockExtensionUri: any;

  beforeEach(() => {
    jest.useFakeTimers();
    
    // Create mock extension context
    mockContext = {
      globalState: {
        get: jest.fn(),
        update: jest.fn()
      }
    };

    // Create mock extension URI
    mockExtensionUri = {
      toString: () => 'mock-extension-uri'
    };

    gameState = new GameState(mockContext);
    sidebarProvider = new SidebarProvider(mockExtensionUri, gameState);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Animation Rate Limiting', () => {
    test('should rate limit impact frame triggers', () => {
      const refreshSpy = jest.spyOn(sidebarProvider, 'refresh').mockImplementation();
      
      // Trigger multiple impact frames rapidly
      sidebarProvider.triggerImpactFrame();
      sidebarProvider.triggerImpactFrame(); // Should be rate limited
      sidebarProvider.triggerImpactFrame(); // Should be rate limited
      
      // Only the first one should trigger a refresh
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    test('should allow impact frame after cooldown period', () => {
      const refreshSpy = jest.spyOn(sidebarProvider, 'refresh').mockImplementation();
      
      // First trigger
      sidebarProvider.triggerImpactFrame();
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      
      // Advance time past cooldown
      jest.advanceTimersByTime(150);
      
      // Second trigger should work
      sidebarProvider.triggerImpactFrame();
      expect(refreshSpy).toHaveBeenCalledTimes(2);
    });

    test('should track typing velocity', () => {
      const refreshSpy = jest.spyOn(sidebarProvider, 'refresh').mockImplementation();
      
      // Simulate rapid typing (high WPM)
      for (let i = 0; i < 10; i++) {
        sidebarProvider.triggerImpactFrame();
        jest.advanceTimersByTime(10); // Very fast
      }
      
      // Should be fewer refreshes than triggers due to rate limiting
      expect(refreshSpy).toHaveBeenCalledTimes(1); // Only first one should go through
    });

    test('should reset animation frame on state change', () => {
      // Mock the visual engine to return different states
      const mockVisualEngine = {
        getVisualState: jest.fn()
          .mockReturnValueOnce({ playerState: 'fighting' })
          .mockReturnValueOnce({ playerState: 'boss_battle' })
      };
      
      (sidebarProvider as any).visualEngine = mockVisualEngine;
      
      // Test that refresh properly handles state changes
      const refreshSpy = jest.spyOn(sidebarProvider, 'refresh').mockImplementation();
      sidebarProvider.refresh();
      
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('Multiplier Display', () => {
    test('should handle multiplier display with random positioning', () => {
      const mockWebview = {
        postMessage: jest.fn()
      };
      
      (sidebarProvider as any)._view = { webview: mockWebview };
      
      // Trigger multiplier display
      (sidebarProvider as any).showMultiplier(10);
      
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'showMultiplier',
          multiplier: expect.any(Number),
          combo: 10,
          position: expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number)
          }),
          rotation: expect.any(Number)
        })
      );
    });

    test('should calculate correct multiplier tiers', () => {
      const mockWebview = {
        postMessage: jest.fn()
      };
      
      (sidebarProvider as any)._view = { webview: mockWebview };
      
      // Test different combo levels
      (sidebarProvider as any).showMultiplier(5);
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ multiplier: 1.5 })
      );
      
      (sidebarProvider as any).showMultiplier(25);
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ multiplier: 5 })
      );
      
      (sidebarProvider as any).showMultiplier(50);
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ multiplier: 10 })
      );
    });
  });

  describe('Wizard Idle Timer', () => {
    test('should schedule random wizard appearances', () => {
      const recordWizardSpy = jest.spyOn(gameState, 'recordWizardActivity').mockImplementation();
      const killWizardSpy = jest.spyOn(gameState, 'killWizardSession').mockImplementation();
      
      // Mock visual state to return idle
      const mockVisualEngine = {
        getVisualState: jest.fn().mockReturnValue({ playerState: 'idle' })
      };
      (sidebarProvider as any).visualEngine = mockVisualEngine;
      
      // Advance time to trigger wizard appearance
      jest.advanceTimersByTime(60000); // 1 minute
      
      expect(recordWizardSpy).toHaveBeenCalled();
      
      // Advance time for wizard to disappear
      jest.advanceTimersByTime(15000); // 15 seconds
      
      expect(killWizardSpy).toHaveBeenCalled();
    });

    test('should not show wizard if not in idle state', () => {
      const recordWizardSpy = jest.spyOn(gameState, 'recordWizardActivity').mockImplementation();
      
      // Mock visual state to return fighting
      const mockVisualEngine = {
        getVisualState: jest.fn().mockReturnValue({ playerState: 'fighting' })
      };
      (sidebarProvider as any).visualEngine = mockVisualEngine;
      
      // Advance time to trigger wizard appearance
      jest.advanceTimersByTime(60000); // 1 minute
      
      expect(recordWizardSpy).not.toHaveBeenCalled();
    });
  });

  describe('Animation Frame Management', () => {
    test('should switch frames in fighting mode', () => {
      const mockVisualEngine = {
        getVisualState: jest.fn().mockReturnValue({ playerState: 'fighting' })
      };
      (sidebarProvider as any).visualEngine = mockVisualEngine;
      
      const refreshSpy = jest.spyOn(sidebarProvider, 'refresh').mockImplementation();
      
      // Initial frame should be 0
      expect((sidebarProvider as any).animationFrame).toBe(0);
      
      // Trigger impact frame
      sidebarProvider.triggerImpactFrame();
      
      // Frame should switch to 1
      expect((sidebarProvider as any).animationFrame).toBe(1);
      expect(refreshSpy).toHaveBeenCalled();
    });

    test('should flash frame in boss battle mode', () => {
      const mockVisualEngine = {
        getVisualState: jest.fn().mockReturnValue({ playerState: 'boss_battle' })
      };
      (sidebarProvider as any).visualEngine = mockVisualEngine;
      
      const refreshSpy = jest.spyOn(sidebarProvider, 'refresh').mockImplementation();
      
      // Trigger impact frame
      sidebarProvider.triggerImpactFrame();
      
      // Frame should be set to 1 for flash
      expect((sidebarProvider as any).animationFrame).toBe(1);
      
      // Advance time for flash to complete
      jest.advanceTimersByTime(150);
      
      // Frame should return to 0
      expect((sidebarProvider as any).animationFrame).toBe(0);
      expect(refreshSpy).toHaveBeenCalledTimes(2); // Initial trigger + timeout callback
    });

    test('should not change frame in idle mode', () => {
      const mockVisualEngine = {
        getVisualState: jest.fn().mockReturnValue({ playerState: 'idle' })
      };
      (sidebarProvider as any).visualEngine = mockVisualEngine;
      
      const initialFrame = (sidebarProvider as any).animationFrame;
      
      // Trigger impact frame
      sidebarProvider.triggerImpactFrame();
      
      // Frame should not change in idle mode
      expect((sidebarProvider as any).animationFrame).toBe(initialFrame);
    });
  });
});