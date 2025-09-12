import * as vscode from 'vscode';
import { GameState } from './gameState';
import { SidebarProvider } from './sidebarProvider';
import { CodeAnalyzer } from './codeAnalyzer';

let gameState: GameState;
let sidebarProvider: SidebarProvider;
let codeAnalyzer: CodeAnalyzer;

export function activate(context: vscode.ExtensionContext) {
    gameState = new GameState(context);
    sidebarProvider = new SidebarProvider(context.extensionUri, gameState);
    codeAnalyzer = new CodeAnalyzer(gameState);

    // Register sidebar
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('codequestSidebar', sidebarProvider)
    );

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

export function deactivate() {}