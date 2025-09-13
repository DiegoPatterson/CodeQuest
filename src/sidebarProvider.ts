import * as vscode from 'vscode';
import { GameState } from './gameState';
import { VisualEngine } from './visualEngine';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codequest.webview';
    
    private _view?: vscode.WebviewView;
    private visualEngine: VisualEngine;
    private animationFrame: number = 0;
    private animationTimer?: NodeJS.Timeout;

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
    }

    private startImageAnimation() {
        // Cycle through images every 5 seconds for slower animation
        this.animationTimer = setInterval(() => {
            const visualState = this.visualEngine.getVisualState();
            
            if (visualState.playerState === 'boss_battle') {
                // Boss battle: cycle between 2 dragon images (0, 1) - HIGHEST PRIORITY
                this.animationFrame = (this.animationFrame + 1) % 2;
            } else if (visualState.useImages) {
                // Idle state: cycle between 2 images (0, 1)
                this.animationFrame = (this.animationFrame + 1) % 2;
            } else if (visualState.playerState === 'fighting') {
                // Combat state: cycle between 3 images (0, 1, 2)
                this.animationFrame = (this.animationFrame + 1) % 3;
            }
            
            this.refresh();
        }, 5000); // 5 second intervals
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
        
        if (isBossBattle) {
            console.log('CodeQuest: ENTERING BOSS BATTLE SECTION!');
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
            
            // Get boss battle details for progress display
            const currentBoss = stats.currentBossBattle;
            const progressPercentage = currentBoss ? Math.min(100, (currentBoss.currentLines / currentBoss.targetLines) * 100) : 0;
            const allSubtasksCompleted = currentBoss?.subtasks?.every(st => st.completed) || false;
            
            // Generate subtasks HTML
            let subtasksHtml = '';
            if (currentBoss?.subtasks && currentBoss.subtasks.length > 0) {
                subtasksHtml = `
                    <div style="margin: 15px 0; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px;">
                        <h4 style="margin: 0 0 10px 0; color: #fff;">📋 Subtasks:</h4>
                        ${currentBoss.subtasks.map(subtask => `
                            <div style="margin: 8px 0; padding: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; display: flex; align-items: center;">
                                <input type="checkbox" 
                                       id="${subtask.id}" 
                                       ${subtask.completed ? 'checked' : ''} 
                                       onchange="toggleSubtask('${subtask.id}')"
                                       style="margin-right: 8px; transform: scale(1.2);">
                                <label for="${subtask.id}" 
                                       style="flex: 1; color: ${subtask.completed ? '#90EE90' : '#fff'}; 
                                              text-decoration: ${subtask.completed ? 'line-through' : 'none'};">
                                    ${subtask.description}
                                </label>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            imageSection = `
                <div class="game-section boss-section">
                    <h3>🐉 BOSS BATTLE! 🐉</h3>
                    <h4>${currentBoss?.name || 'Unknown Boss'}</h4>
                    <img src="${currentImage}" alt="Knight Fighting Dragon" class="game-image" 
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                    <div style="display:none; color: red; padding: 10px; background: rgba(255,0,0,0.1);">
                        ❌ Image failed to load: ${currentImage}
                    </div>
                    <p>⚔️ EPIC DRAGON BATTLE! ⚔️</p>
                    <p>🔥 Combo: ${stats.combo}x 🔥</p>
                    
                    ${subtasksHtml}
                    
                    <div style="margin: 15px 0; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 5px;">
                        <div style="margin-bottom: 8px;">
                            <strong>Progress: ${currentBoss?.currentLines || 0}/${currentBoss?.targetLines || 0} lines</strong>
                        </div>
                        <div style="background: #333; border-radius: 10px; height: 10px; margin-bottom: 10px;">
                            <div style="background: linear-gradient(to right, #ff6b6b, #ffd93d); height: 100%; border-radius: 10px; width: ${progressPercentage}%; transition: width 0.3s ease;"></div>
                        </div>
                        <button onclick="completeBossBattle()" 
                                style="background: ${allSubtasksCompleted ? '#28a745' : '#6c757d'}; 
                                       color: white; border: none; padding: 10px 15px; border-radius: 5px; margin: 5px; 
                                       cursor: ${allSubtasksCompleted ? 'pointer' : 'not-allowed'}; font-weight: bold;
                                       opacity: ${allSubtasksCompleted ? '1' : '0.6'};"
                                ${allSubtasksCompleted ? '' : 'disabled'}>
                            ✅ Complete Boss Battle${allSubtasksCompleted ? '' : ' (Complete all subtasks first)'}
                        </button>
                    </div>
                    
                    <div style="font-size: 10px; color: #888; margin: 10px; padding: 10px; background: rgba(0,0,0,0.2);">
                        <strong>Debug Info:</strong><br>
                        Frame: ${this.animationFrame}<br>
                        Image Found: ${currentImage ? 'Yes' : 'No'}<br>
                        Image URL: ${currentImage}<br>
                        Extension URI: ${this._extensionUri.toString()}<br>
                        Boss Battle Active: ${isBossBattle ? 'Yes' : 'No'}
                    </div>
                </div>
            `;
        } else if (isIdle) {
            // Idle state: cycle between 2 knight images
            const idleImages = [
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Idle', 'pixel art of a knight 1.png')
                ),
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Idle', 'pixel art of a knight 2.png')
                )
            ];
            currentImage = idleImages[this.animationFrame % 2]?.toString() || '';
            console.log('CodeQuest: Idle image selected:', currentImage);
            imageSection = `
                <div class="game-section idle-section">
                    <h3>🏰 Knight's Rest 🏰</h3>
                    <img src="${currentImage}" alt="Knight at Campfire" class="game-image" />
                    <p>🔥 Resting by the campfire... 🔥</p>
                    <p>💤 Ready for your next adventure! 💤</p>
                    <p><small>Debug: Frame ${this.animationFrame}, Image: ${currentImage ? 'Found' : 'Missing'}</small></p>
                    <div style="margin-top: 15px;">
                        <button onclick="startBossBattle()" style="background: #9400D3; color: white; border: none; padding: 8px 12px; border-radius: 5px; margin: 5px; cursor: pointer; font-size: 12px;">🐉 Start Boss Battle</button>
                    </div>
                </div>
            `;
        } else if (isFighting) {
            // Combat state: cycle between 3 knight vs slime images
            const combatImages = [
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Slime', 'Knight V Slime 1.png')
                ),
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Slime', 'Knight V Slime 2.png')
                ),
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Slime', 'Knight V Slime 3.png')
                )
            ];
            currentImage = combatImages[this.animationFrame % 3]?.toString() || '';
            console.log('CodeQuest: Combat image selected:', currentImage);
            imageSection = `
                <div class="game-section combat-section">
                    <h3>⚔️ Combat Mode ⚔️</h3>
                    <img src="${currentImage}" alt="Knight Fighting Slime" class="game-image" />
                    <p>🗡️ Fighting slimes! 🗡️</p>
                    <p>🔥 Combo: ${stats.combo}x 🔥</p>
                    <p><small>Debug: Frame ${this.animationFrame}, Image: ${currentImage ? 'Found' : 'Missing'}</small></p>
                    <div style="margin-top: 15px;">
                        <button onclick="startBossBattle()" style="background: #9400D3; color: white; border: none; padding: 8px 12px; border-radius: 5px; margin: 5px; cursor: pointer; font-size: 12px;">🐉 Start Boss Battle</button>
                    </div>
                </div>
            `;
        } else {
            // Default state - always show a test image to verify webview works
            const testImage = this._view?.webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Idle', 'pixel art of a knight 1.png')
            );
            console.log('CodeQuest: Test image URI:', testImage?.toString());
            imageSection = `
                <div class="game-section">
                    <h3>🎮 CodeQuest Knight Display - TEST MODE 🎮</h3>
                    <div style="background: #444; padding: 20px; margin: 10px; border-radius: 8px;">
                        <p>✅ WebView is working!</p>
                        <p>🔧 Loading image test...</p>
                        <img src="${testImage}" alt="Knight" class="game-image" 
                            onload="this.nextElementSibling.style.display='block'; this.nextElementSibling.innerHTML='✅ Image loaded successfully!'" 
                            onerror="this.nextElementSibling.style.display='block'; this.nextElementSibling.innerHTML='❌ Image failed to load';" />
                        <div style="display:none; color: yellow; font-weight: bold; margin-top: 10px;"></div>
                    </div>
                    <p><strong>State:</strong> ${visualState.playerState}</p>
                    <p><strong>Frame:</strong> ${this.animationFrame}</p>
                    <p><strong>Extension URI:</strong> ${this._extensionUri.toString()}</p>
                    <p><strong>Image URI:</strong> ${testImage?.toString() || 'undefined'}</p>
                    <div style="margin-top: 20px;">
                        <button onclick="startBossBattle()" style="background: #9400D3; color: white; border: none; padding: 10px 15px; border-radius: 5px; margin: 5px; cursor: pointer;">🐉 Test Boss Battle</button>
                    </div>
                </div>
            `;
        }

        // Simplified HTML for debugging
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
        }
        .game-image {
            width: 100%;
            max-width: 250px;
            height: auto;
            border-radius: 8px;
            margin: 10px 0;
        }
        .game-section {
            text-align: center;
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
            background: rgba(0,100,200,0.2);
            border: 1px solid rgba(0,100,200,0.5);
        }
        .idle-section {
            background: rgba(139, 69, 19, 0.3);
            border: 2px solid #8B4513;
        }
        .combat-section {
            background: rgba(220, 20, 60, 0.3);
            border: 2px solid #DC143C;
        }
        .boss-section {
            background: rgba(148, 0, 211, 0.3);
            border: 2px solid #9400D3;
        }
    </style>
</head>
<body>
    <h2>🖼️ Knight Display</h2>
    ${imageSection}
    <hr>
    <p><strong>Level:</strong> ${stats.level}</p>
    <p><strong>Combo:</strong> ${stats.combo}x</p>
    <p><strong>Extension URI:</strong> ${this._extensionUri.toString()}</p>
    
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
    </script>
</body>
</html>`;
    }
}
