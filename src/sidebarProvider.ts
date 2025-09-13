import * as vscode from 'vscode';
import { GameState } from './gameState';
import { VisualEngine } from './visualEngine';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codequest.webview';
    
    private _view?: vscode.WebviewView;
    private visualEngine: VisualEngine;
    private animationFrame: number = 0;
    private animationTimer?: NodeJS.Timeout;
    private currentMultiplier: number = 1;
    private multiplierVisible: boolean = false;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private gameState: GameState
    ) { 
        console.log('CodeQuest: SidebarProvider constructor called');
        console.log('CodeQuest: Extension URI:', _extensionUri?.toString());
        console.log('CodeQuest: GameState:', gameState ? 'exists' : 'null');
        
        try {
            this.visualEngine = new VisualEngine(gameState);
            console.log('CodeQuest: VisualEngine created successfully');
        } catch (error) {
            console.error('CodeQuest: Error creating VisualEngine:', error);
        }
        
        try {
            this.startImageAnimation();
            console.log('CodeQuest: Image animation started');
        } catch (error) {
            console.error('CodeQuest: Error starting animation:', error);
        }

        // Set up multiplier callback
        this.gameState.setMultiplierCallback((combo: number) => {
            this.showMultiplier(combo);
        });

        // Set up impact frame callback for typing-triggered animation
        this.gameState.setImpactFrameCallback(() => {
            this.triggerImpactFrame();
        });
    }

    private startImageAnimation() {
        // Animation is now triggered by typing events, not timers
        // This method is kept for compatibility but does nothing
        console.log('CodeQuest: Image animation now triggered by typing events');
    }

    public triggerImpactFrame() {
        // Trigger frame switch for impact effect when typing
        const visualState = this.visualEngine.getVisualState();
        
        if (visualState.playerState === 'boss_battle') {
            // Boss battle: switch between 2 dragon images (0, 1)
            this.animationFrame = (this.animationFrame + 1) % 2;
        } else if (visualState.playerState === 'fighting') {
            // Combat state: switch between 2 slime images (0, 1)
            this.animationFrame = (this.animationFrame + 1) % 2;
        }
        // Idle state stays static (no frame switching)
        
        // Refresh the webview to show the new frame
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview();
        }
    }

    private showMultiplier(combo: number) {
        // Calculate multiplier tier based on combo
        let multiplier = 1;
        if (combo >= 50) multiplier = 10;
        else if (combo >= 35) multiplier = 7.5;
        else if (combo >= 25) multiplier = 5;
        else if (combo >= 20) multiplier = 4;
        else if (combo >= 15) multiplier = 3;
        else if (combo >= 10) multiplier = 2;
        else if (combo >= 5) multiplier = 1.5;

        this.currentMultiplier = multiplier;
        this.multiplierVisible = true;

        // Generate random position and rotation
        const randomX = Math.random() * 70 + 15; // 15% to 85% from left
        const randomY = Math.random() * 70 + 15; // 15% to 85% from top
        const randomRotation = Math.random() * 180; // 0 to 180 degrees

        // Update webview if it exists
        if (this._view) {
            this._view.webview.postMessage({
                type: 'showMultiplier',
                multiplier: multiplier,
                combo: combo,
                position: { x: randomX, y: randomY },
                rotation: randomRotation
            });
        }

        // Note: Each multiplier now manages its own lifecycle (4 seconds)
        // No global hide timer needed since they can stack
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        console.log('CodeQuest: resolveWebviewView called! This means webview is working!');
        vscode.window.showInformationMessage('🎮 CodeQuest: WebView resolveWebviewView called!');
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'Assets')
            ]
        };

        // Set initial HTML content
        const html = this._getHtmlForWebview();
        console.log('CodeQuest: Setting HTML content, length:', html.length);
        console.log('CodeQuest: HTML preview:', html.substring(0, 200) + '...');
        webviewView.webview.html = html;
        
        console.log('CodeQuest: WebView resolved and HTML set');

        // Show a test message to confirm webview is working
        vscode.window.showInformationMessage('🎮 CodeQuest WebView loaded! Check the Knight Display panel.');

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(data => {
            console.log('CodeQuest: Received message from webview:', data);
            switch (data.type) {
                case 'startBossBattle':
                    vscode.commands.executeCommand('codequest.startBossBattle');
                    break;
                case 'completeBossBattle':
                    vscode.commands.executeCommand('codequest.completeBossBattle');
                    break;
                case 'toggleSubtask':
                    vscode.commands.executeCommand('codequest.toggleSubtask', data.subtaskId);
                    break;
                case 'resetStats':
                    vscode.commands.executeCommand('codequest.resetStats');
                    break;
            }
        });
    }

    refresh() {
        if (this._view) {
            // Check if we should use images for idle state
            const shouldUseImages = this.visualEngine.shouldUseImages();
            console.log('CodeQuest: Refresh - should use images:', shouldUseImages);
            
            if (shouldUseImages) {
                // Cycle animation frame for alternating images
                this.animationFrame = (this.animationFrame + 1) % 2;
            }
            
            this._view.webview.html = this._getHtmlForWebview();
        }
    }

    private _getHtmlForWebview() {
        const stats = this.gameState.getStats();
        console.log('CodeQuest: Getting stats for HTML:', stats);
        const xpPercentage = (stats.xp / stats.xpToNextLevel) * 100;
        
        // Check visual state
        let visualState;
        try {
            visualState = this.visualEngine.getVisualState();
        } catch (error) {
            console.error('CodeQuest: Error getting visual state:', error);
            visualState = { playerState: 'fighting', useImages: false, wizardPresent: false, bossCheckpoints: [] };
        }
        
        const isIdle = visualState.useImages;
        const isFighting = visualState.playerState === 'fighting';
        const isBossBattle = visualState.playerState === 'boss_battle';
        
        console.log('CodeQuest: State check debug:');
        console.log('  - visualState.playerState:', visualState.playerState);
        console.log('  - visualState.useImages:', visualState.useImages);
        console.log('  - isIdle:', isIdle);
        console.log('  - isFighting:', isFighting);
        console.log('  - isBossBattle:', isBossBattle);
        
        // Always show some image to test webview functionality
        let currentImage = '';
        let imageSection = '';
        
        console.log('CodeQuest: Visual state - idle:', isIdle, 'fighting:', isFighting, 'boss:', isBossBattle);
        console.log('CodeQuest: About to choose image section...');
        
        // Define variables for boss battle state
        let allSubtasksCompleted = false;
        let currentBoss: any = null;
        
        if (isBossBattle) {
            console.log('CodeQuest: ENTERING BOSS BATTLE SECTION!');
            // Get boss battle details for progress display
            currentBoss = stats.currentBossBattle;
            allSubtasksCompleted = currentBoss?.subtasks?.every((st: any) => st.completed) || false;
            // Boss Battle state: cycle between 2 knight vs dragon images - HIGHEST PRIORITY
            const bossImages = [
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Boss', 'Knight V Dragon 1.png')
                ),
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Boss', 'Knight V Dragon 2.png')
                )
            ];
            currentImage = bossImages[this.animationFrame % 2]?.toString() || '';
            console.log('CodeQuest: Boss battle mode detected!');
            console.log('CodeQuest: Animation frame:', this.animationFrame);
            console.log('CodeQuest: Boss images array:', bossImages.map(img => img?.toString()));
            console.log('CodeQuest: Selected boss image:', currentImage);
            
            // Calculate progress percentage
            const progressPercentage = currentBoss ? Math.min(100, (currentBoss.currentLines / currentBoss.targetLines) * 100) : 0;
            
            // Generate subtasks HTML for boss battles - simplified for new layout
            if (currentBoss?.subtasks && currentBoss.subtasks.length > 0) {
                imageSection = `
                    <div class="boss-section">
                        <h4 style="margin: 0 0 10px 0; color: #fff;">📋 Subtasks:</h4>
                        ${currentBoss.subtasks.map((subtask: any) => `
                            <div class="subtask">
                                <input type="checkbox" 
                                       id="${subtask.id}" 
                                       ${subtask.completed ? 'checked' : ''} 
                                       onchange="toggleSubtask('${subtask.id}')" />
                                <label for="${subtask.id}">${subtask.description}</label>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                imageSection = '';
            }
        } else if (isIdle) {
            // Idle state: static single image (no cycling)
            const idleImages = [
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Idle', 'pixel art of a knight 1.png')
                )
            ];
            currentImage = idleImages[0]?.toString() || '';
            console.log('CodeQuest: Idle image selected (static):', currentImage);
            imageSection = ''; // No extra section needed for idle state
        } else if (isFighting) {
            // Combat state: cycle between 2 knight vs slime images (removed 3rd image)
            const combatImages = [
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Slime', 'Knight V Slime 1.png')
                ),
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Slime', 'Knight V Slime 2.png')
                )
            ];
            currentImage = combatImages[this.animationFrame % 2]?.toString() || '';
            console.log('CodeQuest: Combat image selected:', currentImage);
            imageSection = ''; // No extra section needed for combat state
        } else {
            // Default state - set a test image
            currentImage = this._view?.webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Idle', 'pixel art of a knight 1.png')
            )?.toString() || '';
            console.log('CodeQuest: Default/test image selected:', currentImage);
            imageSection = ''; // No extra section needed for default state
        }

        // Simplified HTML for cleaner sidebar - just image, multiplier, and buttons
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodeQuest Knight Display</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 10px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            margin: 0;
        }
        .knight-container {
            position: relative;
            text-align: center;
            margin-bottom: 20px;
        }
        .game-image {
            width: 100%;
            max-width: 250px;
            height: auto;
            border-radius: 8px;
            margin: 10px 0;
            transition: transform 0.1s ease;
        }
        .game-image.shake {
            animation: shake 0.5s ease-in-out;
        }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px) translateY(-2px); }
            50% { transform: translateX(5px) translateY(2px); }
            75% { transform: translateX(-3px) translateY(-1px); }
        }
        .multiplier-overlay {
            position: absolute;
            color: #FFD700;
            font-weight: bold;
            font-size: 24px;
            text-shadow: 
                0 0 10px #FFD700,
                0 0 20px #FFD700,
                0 0 30px #FFD700,
                0 0 40px #FFD700,
                2px 2px 4px rgba(0, 0, 0, 0.8);
            opacity: 0;
            transform: scale(0.5);
            transition: all 0.3s ease;
            z-index: 10;
            pointer-events: none;
        }
        .multiplier-overlay.show {
            opacity: 1;
            transform: scale(1);
            animation: pulse 1s infinite alternate;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            100% { transform: scale(1.1); }
        }
        .combo-display {
            font-size: 16px;
            margin: 10px 0;
            color: #FFD700;
            font-weight: bold;
        }
        .action-buttons {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 15px;
        }
        .action-button {
            background: #9400D3;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            transition: background 0.3s ease;
        }
        .action-button:hover {
            background: #7B00B5;
        }
        .action-button:disabled {
            background: #6c757d;
            cursor: not-allowed;
            opacity: 0.6;
        }
        .boss-section {
            background: rgba(148, 0, 211, 0.2);
            border: 2px solid #9400D3;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
        }
        .subtask {
            display: flex;
            align-items: center;
            margin: 8px 0;
            padding: 8px;
            background: rgba(0,0,0,0.3);
            border-radius: 5px;
        }
        .subtask input {
            margin-right: 10px;
            transform: scale(1.2);
        }
    </style>
</head>
<body>
    <div class="knight-container">
        <img id="knightImage" src="${currentImage}" alt="Knight" class="game-image" />
        <div id="multiplierContainer"></div>
    </div>
    
    <div class="combo-display">
        🔥 Combo: ${stats.combo}x 🔥
    </div>
    
    ${imageSection}
    
    <div class="action-buttons">
        ${isBossBattle ? 
            `<button onclick="completeBossBattle()" class="action-button" 
                     ${allSubtasksCompleted ? '' : 'disabled'}>
                ✅ Complete Boss Battle
             </button>` : 
            `<button onclick="startBossBattle()" class="action-button">
                🐉 Start Boss Battle
             </button>`
        }
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function startBossBattle() {
            vscode.postMessage({ type: 'startBossBattle' });
        }
        
        function completeBossBattle() {
            vscode.postMessage({ type: 'completeBossBattle' });
        }
        
        function toggleSubtask(subtaskId) {
            vscode.postMessage({ type: 'toggleSubtask', subtaskId: subtaskId });
        }
        
        // Handle multiplier display messages
        window.addEventListener('message', event => {
            const message = event.data;
            const container = document.getElementById('multiplierContainer');
            const knightImage = document.getElementById('knightImage');
            
            switch (message.type) {
                case 'showMultiplier':
                    // Create a new multiplier element
                    const multiplier = document.createElement('div');
                    multiplier.className = 'multiplier-overlay show';
                    multiplier.textContent = message.multiplier + 'x';
                    
                    // Apply random position and rotation
                    if (message.position && message.rotation !== undefined) {
                        multiplier.style.left = message.position.x + '%';
                        multiplier.style.top = message.position.y + '%';
                        multiplier.style.transform = \`translate(-50%, -50%) scale(1) rotate(\${message.rotation}deg)\`;
                    } else {
                        multiplier.style.transform = 'translate(-50%, -50%) scale(1)';
                    }
                    
                    // Add to container
                    container.appendChild(multiplier);
                    
                    // Add shake effect to knight image
                    if (knightImage) {
                        knightImage.classList.add('shake');
                        setTimeout(() => {
                            knightImage.classList.remove('shake');
                        }, 500);
                    }
                    
                    // Remove this multiplier after 4 seconds (longer linger time)
                    setTimeout(() => {
                        if (multiplier.parentNode) {
                            multiplier.style.opacity = '0';
                            multiplier.style.transform = multiplier.style.transform + ' scale(0.3)';
                            setTimeout(() => {
                                if (multiplier.parentNode) {
                                    container.removeChild(multiplier);
                                }
                            }, 300);
                        }
                    }, 4000);
                    break;
                case 'hideMultiplier':
                    // Clear all multipliers (if needed for manual clearing)
                    container.innerHTML = '';
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
