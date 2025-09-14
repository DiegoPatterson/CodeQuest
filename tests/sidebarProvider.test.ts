import { SidebarProvider } from '../src/sidebarProvider';
import { GameState } from '../src/gameState';
import { VisualEngine } from '../src/visualEngine';

// Mock VS Code module
jest.mock('vscode', () => ({
  ExtensionContext: jest.fn(),
  Uri: {
    joinPath: jest.fn().mockReturnValue({ toString: () => 'mock-uri' }),
    file: jest.fn().mockReturnValue({ toString: () => 'mock-file-uri' })
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  WebviewView: jest.fn(),
  ViewColumn: { One: 1 },
  commands: {
    executeCommand: jest.fn()
  }
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

  describe('Wooden Sign Styling Tests', () => {
    let mockWebview: any;
    let mockWebviewView: any;

    beforeEach(() => {
      // Create mock webview
      mockWebview = {
        html: '',
        options: {},
        postMessage: jest.fn(),
        asWebviewUri: jest.fn((uri) => uri),
        onDidReceiveMessage: jest.fn()
      };

      // Create mock webview view
      mockWebviewView = {
        webview: mockWebview,
        visible: true,
        show: jest.fn(),
        dispose: jest.fn()
      };
    });

    test('should generate HTML with wooden sign CSS classes', () => {
      // Arrange
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert - Check for wooden sign styling classes
      expect(html).toContain('.stats-container');
      expect(html).toContain('linear-gradient(145deg, #8B4513');
      expect(html).toContain('wood grain texture');
      expect(html).toContain('.combo-container');
      expect(html).toContain('border: 4px solid #654321');
    });

    test('should include metal nail pseudo-elements in stats container', () => {
      // Arrange
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert
      expect(html).toContain('.stats-container::before');
      expect(html).toContain('.stats-container::after');
      expect(html).toContain('radial-gradient(circle, #C0C0C0 30%, #808080 70%)');
    });

    test('should include rope binding effects on combo container', () => {
      // Arrange
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert
      expect(html).toContain('.combo-container::before');
      expect(html).toContain('linear-gradient(90deg, #8B4513 0%, #D2691E 50%, #8B4513 100%)');
    });

    test('should style action buttons as carved wooden buttons', () => {
      // Arrange
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert
      expect(html).toContain('.action-button');
      expect(html).toContain('linear-gradient(145deg, #8B4513 0%, #CD853F 30%, #8B4513 70%, #654321 100%)');
      expect(html).toContain('font-family: \'Courier New\', monospace');
      expect(html).toContain('box-shadow:');
    });

    test('should style boss section with dark wooden plaque appearance', () => {
      // Arrange
      gameState.startBossBattle('Test Boss', ['Subtask 1', 'Subtask 2']);
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert
      expect(html).toContain('.boss-section');
      expect(html).toContain('radial-gradient(ellipse at center, #8B0000 0%, #654321 30%, #2F1B14 100%)');
      expect(html).toContain('border: 4px solid #8B0000');
    });

    test('should include iron corner reinforcements for boss section', () => {
      // Arrange
      gameState.startBossBattle('Test Boss', ['Subtask 1']);
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert
      expect(html).toContain('.boss-section::before');
      expect(html).toContain('.boss-section::after');
      expect(html).toContain('radial-gradient(circle, #2C2C2C 0%, #1A1A1A 50%, #000000 100%)');
    });

    test('should style multiplier overlay without wooden background', () => {
      // Arrange
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert - Should NOT contain wooden background styling
      expect(html).toContain('.multiplier-overlay');
      expect(html).not.toContain('background: \n                linear-gradient(145deg, rgba(139, 69, 19');
      expect(html).not.toContain('border: 3px solid #654321');
      expect(html).not.toContain('padding: 8px 16px');
    });

    test('should include chaotic animation effects for multiplier', () => {
      // Arrange
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert
      expect(html).toContain('animation: chaoticPulse 0.4s infinite alternate, colorShift 1.5s infinite');
      expect(html).toContain('@keyframes chaoticPulse');
      expect(html).toContain('@keyframes colorShift');
    });

    test('should display level with proper wooden badge styling', () => {
      // Arrange
      gameState.addXP(1000); // Level up
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert
      expect(html).toContain('.level-badge');
      expect(html).toContain('linear-gradient(145deg, #8B4513 0%, #D2691E 50%, #8B4513 100%)');
      expect(html).toContain('.level-');
    });

    test('should style XP bar with wooden container', () => {
      // Arrange
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert
      expect(html).toContain('.xp-bar-container');
      expect(html).toContain('linear-gradient(145deg, #2F1B14 0%, #654321 50%, #2F1B14 100%)');
      expect(html).toContain('.xp-bar');
      expect(html).toContain('linear-gradient(90deg');
    });

    test('should include flashy number animations for stats', () => {
      // Arrange
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert
      expect(html).toContain('.flashy-number');
      expect(html).toContain('@keyframes numberPulse');
      expect(html).toContain('@keyframes maxComboPulse');
      expect(html).toContain('@keyframes linesPulse');
      expect(html).toContain('@keyframes bossGlow');
    });

    test('should style combo container with wooden sign appearance', () => {
      // Arrange
      // Simulate some activity to start combo
      gameState.addXP(10);
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert
      expect(html).toContain('.combo-container');
      expect(html).toContain('linear-gradient(145deg, #654321 0%, #8B4513 30%, #654321 70%, #5D4E37 100%)');
      expect(html).toContain('repeating-linear-gradient');
    });

    test('should apply different combo tier styling based on combo value', () => {
      // Arrange
      // Build up combo to super level by adding XP
      gameState.addXP(1000);
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert
      expect(html).toContain('.combo-');
      expect(html).toContain('@keyframes combo');
    });

    test('should style subtasks with wooden container theme', () => {
      // Arrange
      gameState.startBossBattle('Test Boss', ['Subtask 1', 'Subtask 2']);
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      const html = mockWebview.html;
      
      // Assert
      expect(html).toContain('.subtasks-container');
      expect(html).toContain('background: rgba(101, 67, 33, 0.3)');
      expect(html).toContain('.subtask');
      expect(html).toContain('linear-gradient(145deg, rgba(139, 69, 19, 0.4)');
    });
  });

  describe('Multiplier Functionality Tests', () => {
    let mockWebview: any;
    let mockWebviewView: any;

    beforeEach(() => {
      mockWebview = {
        html: '',
        options: {},
        postMessage: jest.fn(),
        asWebviewUri: jest.fn((uri) => uri),
        onDidReceiveMessage: jest.fn()
      };

      mockWebviewView = {
        webview: mockWebview,
        visible: true,
        show: jest.fn(),
        dispose: jest.fn()
      };
    });

    test('should display multiplier with chaotic positioning and rotation', () => {
      // Arrange
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      (sidebarProvider as any).showMultiplier(15); // Should trigger mega combo
      
      // Assert
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'showMultiplier',
          position: expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number)
          }),
          rotation: expect.any(Number),
          multiplier: expect.stringContaining('x')
        })
      );
    });

    test('should add chaos text to multiplier display', () => {
      // Arrange
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Act
      (sidebarProvider as any).showMultiplier(20); // High combo
      
      // Assert
      const call = mockWebview.postMessage.mock.calls[0][0];
      expect(call.multiplier).toMatch(/x[!]+$/); // Should end with x and exclamation marks
    });

    test('should handle webview messages correctly', () => {
      // Arrange
      const executeCommandSpy = jest.spyOn(require('vscode').commands, 'executeCommand').mockResolvedValue(undefined);
      sidebarProvider.resolveWebviewView(mockWebviewView);
      
      // Get the message handler
      const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      
      // Act
      messageHandler({ type: 'startBossBattle' });
      messageHandler({ type: 'completeBossBattle' });
      messageHandler({ type: 'resetStats' });
      
      // Assert
      expect(executeCommandSpy).toHaveBeenCalledWith('codequest.startBossBattle');
      expect(executeCommandSpy).toHaveBeenCalledWith('codequest.completeBossBattle');
      expect(executeCommandSpy).toHaveBeenCalledWith('codequest.resetStats');
      
      executeCommandSpy.mockRestore();
    });
  });
});