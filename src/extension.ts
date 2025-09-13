import * as vscode from 'vscode';
import { GameState } from './gameState';
import { SidebarProvider } from './sidebarProvider';
import { CodeAnalyzer } from './codeAnalyzer';
import { TestWebviewProvider } from './testWebviewProvider';
import { GameStatsTreeProvider } from './gameStatsTreeProvider';

let gameState: GameState;
let sidebarProvider: SidebarProvider;
let codeAnalyzer: CodeAnalyzer;
let treeProvider: GameStatsTreeProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('CodeQuest: Extension activating...');
    
    gameState = new GameState(context);
    console.log('CodeQuest: GameState created');
    
    sidebarProvider = new SidebarProvider(context.extensionUri, gameState);
    console.log('CodeQuest: SidebarProvider created');
    
    treeProvider = new GameStatsTreeProvider(gameState);
    console.log('CodeQuest: TreeProvider created');
    
    codeAnalyzer = new CodeAnalyzer(gameState);

    // Set up refresh callback for combo decay
    gameState.setRefreshCallback(() => {
        console.log('CodeQuest: Refreshing UI due to combo decay');
        sidebarProvider.refresh();
        treeProvider.refresh();
    });

    console.log('CodeQuest: Created providers');

    // Register tree data provider (this should definitely work)
    try {
        const treeView = vscode.window.registerTreeDataProvider('codequest.sidebar', treeProvider);
        context.subscriptions.push(treeView);
        console.log('CodeQuest: Successfully registered TreeDataProvider for codequest.sidebar');
    } catch (error) {
        console.error('CodeQuest: Failed to register TreeDataProvider:', error);
    }

    // Also try webview provider (in case it works)
    try {
        const provider = vscode.window.registerWebviewViewProvider(
            'codequest.webview', 
            sidebarProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        );
        context.subscriptions.push(provider);
        console.log('CodeQuest: Successfully registered webview provider for codequest.webview');
        
        // Also register a test provider to see if basic webview works
        const testProvider = vscode.window.registerWebviewViewProvider(
            'codequest.test',
            new TestWebviewProvider()
        );
        context.subscriptions.push(testProvider);
        console.log('CodeQuest: Registered test webview provider');
        
    } catch (error) {
        console.error('CodeQuest: Failed to register webview provider:', error);
    }

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('codequest.startBossBattle', () => {
            startBossBattle();
        }),
        vscode.commands.registerCommand('codequest.completeBossBattle', () => {
            gameState.completeBossBattle();
            sidebarProvider.refresh();
            treeProvider.refresh();
        }),
        vscode.commands.registerCommand('codequest.resetStats', () => {
            gameState.resetStats();
            sidebarProvider.refresh();
            treeProvider.refresh();
            vscode.window.showInformationMessage('CodeQuest stats reset!');
        })
    );

    // Listen to text document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            const analysis = codeAnalyzer.analyzeChange(event);
            sidebarProvider.refresh();
            
            // Pass word counts and AI detection to tree provider for dynamic visuals
            const wordsTyped = analysis?.wordsAdded || 0;
            const hasAI = analysis?.aiDetected || false;
            treeProvider.refresh(wordsTyped, hasAI);
        })
    );

    // Daily streak check
    setInterval(() => {
        gameState.checkDailyStreak();
        sidebarProvider.refresh();
        treeProvider.refresh();
    }, 60000); // Check every minute

    console.log('CodeQuest: Fully activated');
    vscode.window.showInformationMessage('🎮 CodeQuest activated! Start your coding adventure!');
}

async function startBossBattle() {
    const taskName = await vscode.window.showInputBox({
        prompt: 'Enter your boss battle task',
        placeHolder: 'e.g., "Implement user authentication system"'
    });
    
    if (taskName) {
        gameState.startBossBattle(taskName);
        sidebarProvider.refresh();
        treeProvider.refresh();
        vscode.window.showInformationMessage(`🐉 Boss Battle Started: ${taskName}`);
    }
}

export function deactivate() {
    console.log('CodeQuest: Extension deactivated');
}