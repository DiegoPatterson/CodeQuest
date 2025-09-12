import * as vscode from 'vscode';
import { GameState } from './gameState';
import { SidebarProvider } from './sidebarProvider';
import { CodeAnalyzer } from './codeAnalyzer';

let gameState: GameState;
let sidebarProvider: SidebarProvider;
let codeAnalyzer: CodeAnalyzer;

export function activate(context: vscode.ExtensionContext) {
    console.log('CodeQuest: Extension activating...');
    
    gameState = new GameState(context);
    sidebarProvider = new SidebarProvider(context.extensionUri, gameState);
    codeAnalyzer = new CodeAnalyzer(gameState);

    console.log('CodeQuest: Created providers');

    // Register sidebar - THIS IS THE CRITICAL LINE
    const provider = vscode.window.registerWebviewViewProvider('codequest.sidebar', sidebarProvider);
    context.subscriptions.push(provider);
    
    console.log('CodeQuest: Registered webview provider');

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('codequest.startBossBattle', () => {
            startBossBattle();
        }),
        vscode.commands.registerCommand('codequest.completeBossBattle', () => {
            gameState.completeBossBattle();
            sidebarProvider.refresh();
        }),
        vscode.commands.registerCommand('codequest.resetStats', () => {
            gameState.resetStats();
            sidebarProvider.refresh();
            vscode.window.showInformationMessage('CodeQuest stats reset!');
        })
    );

    // Listen to text document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            codeAnalyzer.analyzeChange(event);
            sidebarProvider.refresh();
        })
    );

    // Daily streak check
    setInterval(() => {
        gameState.checkDailyStreak();
        sidebarProvider.refresh();
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
        vscode.window.showInformationMessage(`🐉 Boss Battle Started: ${taskName}`);
    }
}

export function deactivate() {
    console.log('CodeQuest: Extension deactivated');
}