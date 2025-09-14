import * as assert from 'assert';
import { SidebarProvider } from '../src/sidebarProvider';
import { GameState } from '../src/gameState';
import { VisualEngine } from '../src/visualEngine';

// Mock vscode module for testing
const mockContext = {
  globalState: { get: jest.fn(), update: jest.fn() },
  subscriptions: [],
  workspaceState: { get: jest.fn(), update: jest.fn() },
  extensionPath: '/mock/path',
  extensionUri: { toString: () => 'mock-extension-uri' },
  storagePath: '/mock/storage',
  globalStoragePath: '/mock/global-storage',
  logPath: '/mock/log'
};

const mockExtensionUri = {
  scheme: 'file',
  authority: '',
  path: '/mock/path',
  query: '',
  fragment: '',
  fsPath: '/mock/path',
  toString: () => 'mock-extension-uri',
  toJSON: () => ({ scheme: 'file', authority: '', path: '/mock/path', query: '', fragment: '' }),
  with: jest.fn(),
  joinPath: jest.fn()
};

/**
 * Integration test to validate actual HTML output contains wooden sign styling
 */
describe('Wooden Sign Integration Test', () => {
  let sidebarProvider: SidebarProvider;
  let gameState: GameState;
  let visualEngine: VisualEngine;

  beforeEach(() => {
    gameState = new GameState(mockContext as any);
    visualEngine = new VisualEngine(gameState);
    sidebarProvider = new SidebarProvider(mockExtensionUri, gameState);
    
    // Inject the visual engine for testing
    (sidebarProvider as any).visualEngine = visualEngine;
  });

  test('should generate complete HTML with all wooden sign styling', () => {
    // Create mock webview
    const mockWebview = {
      html: '',
      options: {},
      postMessage: jest.fn(),
      asWebviewUri: jest.fn((uri) => uri),
      onDidReceiveMessage: jest.fn()
    };

    const mockWebviewView = {
      webview: mockWebview,
      visible: true,
      show: jest.fn(),
      dispose: jest.fn()
    };

    // Resolve webview to generate HTML
    sidebarProvider.resolveWebviewView(mockWebviewView as any);
    
    const html = mockWebview.html;
    
    console.log('\n🧪 TESTING ACTUAL GENERATED HTML OUTPUT');
    console.log('=====================================');
    
    // Test wooden color scheme
    const woodenColors = ['#8B4513', '#CD853F', '#654321', '#F5DEB3', '#FFD700'];
    woodenColors.forEach(color => {
      if (html.includes(color)) {
        console.log(`✅ Wooden color ${color} found`);
      } else {
        console.log(`❌ Wooden color ${color} missing`);
      }
    });
    
    // Test CSS features
    const cssFeatures = [
      'linear-gradient(145deg',
      'repeating-linear-gradient',
      'box-shadow:',
      'inset',
      '::before',
      '::after',
      'font-family: \'Courier New\', monospace',
      'border-radius: 12px'
    ];
    
    cssFeatures.forEach(feature => {
      if (html.includes(feature)) {
        console.log(`✅ CSS feature ${feature} found`);
      } else {
        console.log(`❌ CSS feature ${feature} missing`);
      }
    });
    
    // Test animations
    const animations = ['chaoticPulse', 'colorShift', '@keyframes'];
    animations.forEach(animation => {
      if (html.includes(animation)) {
        console.log(`✅ Animation ${animation} found`);
      } else {
        console.log(`❌ Animation ${animation} missing`);
      }
    });
    
    // Core assertions
    expect(html).toContain('.stats-container');
    expect(html).toContain('#8B4513'); // Saddle brown
    expect(html).toContain('linear-gradient');
    expect(html).toContain('chaoticPulse');
    expect(html).toContain('colorShift');
    expect(html).toContain('font-family: \'Courier New\', monospace');
    
    console.log('\n📏 HTML Content Stats:');
    console.log(`   Total length: ${html.length} characters`);
    console.log(`   Contains CSS: ${html.includes('<style>') ? 'Yes' : 'No'}`);
    console.log(`   Contains HTML: ${html.includes('<div') ? 'Yes' : 'No'}`);
    
    // Validate specific wooden sign elements
    expect(html).toContain('wood grain texture'); // Comment should be present
    expect(html).toContain('.combo-container'); // Wooden combo container
    expect(html).toContain('.action-button'); // Wooden buttons
  });

  test('should include boss battle wooden styling when in boss mode', () => {
    // Start a boss battle
    gameState.startBossBattle('Test Dragon', ['Defeat minions', 'Find treasure']);
    
    const mockWebview = {
      html: '',
      options: {},
      postMessage: jest.fn(),
      asWebviewUri: jest.fn((uri) => uri),
      onDidReceiveMessage: jest.fn()
    };

    const mockWebviewView = {
      webview: mockWebview,
      visible: true,
      show: jest.fn(),
      dispose: jest.fn()
    };

    sidebarProvider.resolveWebviewView(mockWebviewView as any);
    const html = mockWebview.html;
    
    console.log('\n🐉 TESTING BOSS BATTLE WOODEN STYLING');
    console.log('===================================');
    
    // Test boss-specific styling
    const bossFeatures = [
      '.boss-section',
      '#8B0000', // Dark red
      '#2F1B14', // Very dark brown
      'radial-gradient(ellipse at center',
      '.subtasks-container',
      'rgba(101, 67, 33, 0.3)'
    ];
    
    bossFeatures.forEach(feature => {
      if (html.includes(feature)) {
        console.log(`✅ Boss feature ${feature} found`);
      } else {
        console.log(`❌ Boss feature ${feature} missing`);
      }
    });
    
    expect(html).toContain('.boss-section');
    expect(html).toContain('#8B0000'); // Dark red for boss
    expect(html).toContain('Test Dragon'); // Boss name
  });

  test('should preserve chaotic multiplier without wooden background', () => {
    const mockWebview = {
      html: '',
      options: {},
      postMessage: jest.fn(),
      asWebviewUri: jest.fn((uri) => uri),
      onDidReceiveMessage: jest.fn()
    };

    const mockWebviewView = {
      webview: mockWebview,
      visible: true,
      show: jest.fn(),
      dispose: jest.fn()
    };

    sidebarProvider.resolveWebviewView(mockWebviewView as any);
    const html = mockWebview.html;
    
    console.log('\n⚡ TESTING MULTIPLIER OVERLAY STYLING');
    console.log('==================================');
    
    // Find multiplier overlay section
    const multiplierMatch = html.match(/\.multiplier-overlay\s*{[^}]+}/s);
    
    if (multiplierMatch) {
      const multiplierCSS = multiplierMatch[0];
      console.log('Multiplier CSS found:', multiplierCSS.substring(0, 100) + '...');
      
      // Should NOT contain wooden background
      expect(multiplierCSS).not.toContain('background:');
      expect(multiplierCSS).not.toContain('border:');
      expect(multiplierCSS).not.toContain('padding:');
      
      console.log('✅ Multiplier correctly has no wooden background');
    } else {
      console.log('❌ Multiplier overlay CSS not found');
    }
    
    // Should contain chaotic animations
    expect(html).toContain('chaoticPulse');
    expect(html).toContain('colorShift');
    expect(html).toContain('font-family: \'Impact\', \'Arial Black\', sans-serif');
    
    console.log('✅ Chaotic animations preserved');
  });
});

// Export to allow running as standalone test
export {};