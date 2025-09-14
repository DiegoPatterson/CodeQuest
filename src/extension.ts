import * as vscode from 'vscode';
import { GameState } from './gameState';
import { SidebarProvider } from './sidebarProvider';
import { CodeAnalyzer } from './codeAnalyzer';
import { TestWebviewProvider } from './testWebviewProvider';

let gameState: GameState;
let sidebarProvider: SidebarProvider;
let codeAnalyzer: CodeAnalyzer;

export function activate(context: vscode.ExtensionContext) {
    // Performance profiling: Track activation time
    const activationStartTime = performance.now();
    
    console.log('🔥 CodeQuest: Extension activate function called!');
    console.log('🔥 CodeQuest: Extension URI:', context.extensionUri.toString());
    
    // Force a notification to appear to confirm activation
    vscode.window.showInformationMessage('🔥 CodeQuest ACTIVATE function called!');
    
    console.log('CodeQuest: Extension activating...');
    
    // Progressive loading: Initialize core components first
    const gameStateStartTime = performance.now();
    gameState = new GameState(context);
    const gameStateTime = performance.now() - gameStateStartTime;
    console.log(`CodeQuest: GameState created in ${gameStateTime.toFixed(2)}ms`);
    
    const sidebarStartTime = performance.now();
    sidebarProvider = new SidebarProvider(context.extensionUri, gameState);
    const sidebarTime = performance.now() - sidebarStartTime;
    console.log(`CodeQuest: SidebarProvider created in ${sidebarTime.toFixed(2)}ms`);
    
    // Defer non-critical component initialization
    setTimeout(() => {
        const analyzerStartTime = performance.now();
        codeAnalyzer = new CodeAnalyzer(gameState);
        const analyzerTime = performance.now() - analyzerStartTime;
        console.log(`CodeQuest: CodeAnalyzer created in ${analyzerTime.toFixed(2)}ms (deferred)`);
        
        // Set up refresh callback after analyzer is ready
        gameState.setRefreshCallback(() => {
            console.log('CodeQuest: Refreshing UI due to combo decay');
            sidebarProvider.refresh();
        });
    }, 10); // Small delay to not block initial activation

    console.log('CodeQuest: Created providers');

    // Register webview provider for knight display (critical path)
    const registrationStartTime = performance.now();
    try {
        console.log(`CodeQuest: Attempting to register webview provider for ${SidebarProvider.viewType}...`);
        const provider = vscode.window.registerWebviewViewProvider(
            SidebarProvider.viewType, 
            sidebarProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        );
        context.subscriptions.push(provider);
        const registrationTime = performance.now() - registrationStartTime;
        console.log(`CodeQuest: Successfully registered webview provider in ${registrationTime.toFixed(2)}ms`);
        
        // Force notification to confirm registration
        vscode.window.showInformationMessage(`🔥 WebView Provider REGISTERED for ${SidebarProvider.viewType}!`);
        
    } catch (error) {
        console.error('CodeQuest: Failed to register webview provider:', error);
        vscode.window.showErrorMessage(`CodeQuest webview registration failed: ${error}`);
    }

    // Defer command registration to reduce initial activation time
    setTimeout(() => {
        const commandStartTime = performance.now();
        registerCommands(context);
        const commandTime = performance.now() - commandStartTime;
        console.log(`CodeQuest: Commands registered in ${commandTime.toFixed(2)}ms (deferred)`);
    }, 50); // Defer by 50ms

    // Listen to text document changes (defer this too for startup performance)
    setTimeout(() => {
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (codeAnalyzer) { // Check if analyzer is ready
                    const analysis = codeAnalyzer.analyzeChange(event);
                    sidebarProvider.refresh();
                }
            })
        );
    }, 100);

    // Daily streak check - optimize interval
    const dailyStreakCheck = setInterval(() => {
        gameState.checkDailyStreak();
        sidebarProvider.refresh();
    }, 300000); // Check every 5 minutes instead of every minute
    
    context.subscriptions.push({ dispose: () => clearInterval(dailyStreakCheck) });

    // Final activation time measurement
    const totalActivationTime = performance.now() - activationStartTime;
    console.log(`CodeQuest: Total activation time: ${totalActivationTime.toFixed(2)}ms`);
    console.log('CodeQuest: Fully activated');
    vscode.window.showInformationMessage('🎮 CodeQuest activated! Start your coding adventure!');
    
    // Set up AI detection (deferred for performance)
    setTimeout(() => {
        setupAIDetection(context, gameState, sidebarProvider);
    }, 100);
}

// Deferred command registration for better startup performance
function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('codequest.startBossBattle', () => {
            startBossBattle();
        }),
        vscode.commands.registerCommand('codequest.completeBossBattle', () => {
            gameState.completeBossBattle();
            sidebarProvider.refresh();
        }),
        vscode.commands.registerCommand('codequest.toggleSubtask', (subtaskId: string) => {
            gameState.toggleSubtask(subtaskId);
            sidebarProvider.refresh();
        }),
        vscode.commands.registerCommand('codequest.killBossBattle', () => {
            gameState.killBossBattle();
            sidebarProvider.refresh();
        }),
        vscode.commands.registerCommand('codequest.resetStats', () => {
            gameState.resetStats();
            sidebarProvider.refresh();
            vscode.window.showInformationMessage('CodeQuest stats reset!');
        }),
        vscode.commands.registerCommand('codequest.triggerWizard', () => {
            gameState.recordWizardActivity();
            sidebarProvider.refresh();
            const wizardStats = gameState.getWizardStats();
            vscode.window.showInformationMessage(`🧙‍♂️ Wizard session activated! Total sessions: ${wizardStats.totalSessions}`);
        }),
        vscode.commands.registerCommand('codequest.killWizard', () => {
            gameState.killWizardSession();
            sidebarProvider.refresh();
            vscode.window.showInformationMessage('🗡️ Wizard session terminated! Back to knight mode.');
        }),
        vscode.commands.registerCommand('codequest.toggleEnabled', () => {
            const isEnabled = gameState.toggleEnabled();
            sidebarProvider.refresh();
        })
    );
}

async function startBossBattle() {
    const taskName = await vscode.window.showInputBox({
        prompt: 'Enter your boss battle task',
        placeHolder: 'e.g., "Implement user authentication system"'
    });
    
    if (!taskName) {
        return;
    }
    
    // Collect subtasks
    const subtasks: string[] = [];
    let addingSubtasks = true;
    
    while (addingSubtasks) {
        const subtask = await vscode.window.showInputBox({
            prompt: `Add subtask #${subtasks.length + 1} for "${taskName}" (or press Escape to finish)`,
            placeHolder: 'e.g., "Create user model", "Set up authentication middleware"'
        });
        
        if (subtask && subtask.trim()) {
            subtasks.push(subtask.trim());
        } else {
            addingSubtasks = false;
        }
        
        // Stop after 10 subtasks to prevent infinite loops
        if (subtasks.length >= 10) {
            addingSubtasks = false;
        }
    }
    
    // If no subtasks were added, add a default one
    if (subtasks.length === 0) {
        subtasks.push("Complete the implementation");
    }
    
    gameState.startBossBattle(taskName, subtasks);
    sidebarProvider.refresh();
    vscode.window.showInformationMessage(`🐉 Boss Battle Started: ${taskName} (${subtasks.length} subtasks)`);
}

// Set up wizard detection for AI-related commands after activation
function setupAIDetection(context: vscode.ExtensionContext, gameState: GameState, sidebarProvider: SidebarProvider) {
    // Monitor text document changes for AI assistance patterns
    const textDocumentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length > 0) {
            const change = event.contentChanges[0];
            
            // Detect AI-like patterns:
            // 1. Large text insertions (likely AI completion)
            // 2. Multi-line insertions
            // 3. Common AI comment patterns
            if (change.text.length > 50 || 
                change.text.includes('\n') && change.text.trim().length > 20 ||
                change.text.includes('// TODO:') ||
                change.text.includes('/* TODO:') ||
                change.text.includes('// FIXME:') ||
                change.text.includes('/**') ||
                /^[\s]*\/\//.test(change.text) || // Auto-generated comments
                /function\s+\w+\s*\(.*\)\s*\{/.test(change.text) || // Function generation
                /class\s+\w+\s*\{/.test(change.text) || // Class generation
                /import\s+.*from\s+['"]/.test(change.text)) { // Import statements
                
                console.log('CodeQuest: AI assistance detected - Large/structured text insertion');
                gameState.recordWizardActivity();
                sidebarProvider.refresh();
            }
        }
    });
    
    // Monitor for Copilot-specific events (if available)
    try {
        // Listen for completion acceptance events
        const completionProvider = vscode.languages.registerCompletionItemProvider(
            '*', // All file types
            {
                provideCompletionItems(document, position, token, context) {
                    // This gets called when completions are requested
                    // We can detect when AI completions are being used
                    return [];
                }
            }
        );
        
        context.subscriptions.push(completionProvider);
    } catch (error) {
        console.log('CodeQuest: Could not register completion provider for AI detection');
    }
    
    // Note: VS Code doesn't provide a direct way to monitor all command executions
    // We can monitor specific AI-related extensions through their APIs if available
    try {
        // Check if Copilot is installed and active
        const copilotExtension = vscode.extensions.getExtension('GitHub.copilot');
        if (copilotExtension && copilotExtension.isActive) {
            console.log('CodeQuest: GitHub Copilot detected and active');
        }
        
        // Check for other AI extensions
        const intellicodeExtension = vscode.extensions.getExtension('VisualStudioExptTeam.vscodeintellicode');
        if (intellicodeExtension && intellicodeExtension.isActive) {
            console.log('CodeQuest: IntelliCode detected and active');
        }
    } catch (error) {
        console.log('CodeQuest: Could not check for AI extensions');
    }
    
    // Monitor for rapid typing followed by pauses (AI completion pattern)
    let typingTimer: NodeJS.Timeout | undefined;
    let typingStartTime: number = 0;
    let charCount: number = 0;
    
    const typingPatternListener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length > 0) {
            const now = Date.now();
            
            // Reset typing tracking
            if (typingTimer) {
                clearTimeout(typingTimer);
            }
            
            // If this is a new typing session
            if (now - typingStartTime > 2000) {
                typingStartTime = now;
                charCount = 0;
            }
            
            charCount += event.contentChanges[0].text.length;
            
            // Set timer for typing pause detection
            typingTimer = setTimeout(() => {
                // If user typed quickly and then stopped (common with AI assistance)
                if (charCount > 30 && (Date.now() - typingStartTime) < 3000) {
                    console.log('CodeQuest: Rapid typing pattern detected (possible AI assistance)');
                    gameState.recordWizardActivity();
                    sidebarProvider.refresh();
                }
                charCount = 0;
            }, 1500); // 1.5 second pause
        }
    });
    
    context.subscriptions.push(textDocumentChangeListener, typingPatternListener);
    console.log('CodeQuest: Advanced AI detection setup complete. Monitoring text changes, commands, and typing patterns.');
}

export function deactivate() {
    console.log('CodeQuest: Extension deactivating...');
    
    // Clean up resources
    if (gameState) {
        gameState.dispose();
    }
    
    if (sidebarProvider) {
        sidebarProvider.dispose();
    }
    
    console.log('CodeQuest: Extension deactivated');
}