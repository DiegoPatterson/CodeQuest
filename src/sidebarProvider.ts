import * as vscode from 'vscode';
import { GameState } from './gameState';
import { VisualEngine } from './visualEngine';
import { SoundManager } from './soundManager';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codequest.webview';
    
    private _view?: vscode.WebviewView;
    private visualEngine: VisualEngine;
    private animationFrame: number = 0;
    private animationTimer?: NodeJS.Timeout;
    private currentMultiplier: number = 1;
    private multiplierVisible: boolean = false;
    private idleWizardTimer?: NodeJS.Timeout;
    private lastPlayerState: string = '';
    
    // Rate limiting for animations
    private lastAnimationTrigger: number = 0;
    private animationCooldown: number = 100; // Minimum 100ms between animations
    private typingVelocityTracker: number[] = [];
    private lastTypingTime: number = 0;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private gameState: GameState,
        private soundManager?: SoundManager
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

        // Set up random idle wizard appearances
        this.startIdleWizardTimer();
    }

    private startImageAnimation() {
        // Animation is now triggered by typing events, not timers
        // This method is kept for compatibility but does nothing
        console.log('CodeQuest: Image animation now triggered by typing events');
    }

    public triggerImpactFrame() {
        const now = Date.now();
        
        // Rate limiting: prevent animation spam
        if (now - this.lastAnimationTrigger < this.animationCooldown) {
            console.log('CodeQuest: Animation rate limited, skipping trigger');
            return;
        }
        
        // Track typing velocity to detect AI assistance patterns
        this.typingVelocityTracker.push(now);
        
        // Keep only last 10 keystrokes for velocity calculation
        if (this.typingVelocityTracker.length > 10) {
            this.typingVelocityTracker = this.typingVelocityTracker.slice(-10);
        }
        
        // Calculate WPM if we have enough data points
        if (this.typingVelocityTracker.length >= 5) {
            const timeSpan = now - this.typingVelocityTracker[0];
            const wpm = (this.typingVelocityTracker.length * 60000) / (timeSpan * 5); // Rough WPM calculation
            
            // If typing faster than 300 WPM, increase cooldown (likely AI assistance)
            if (wpm > 300) {
                this.animationCooldown = 300; // Slow down animations during AI assistance
                console.log('CodeQuest: High WPM detected (' + Math.round(wpm) + '), increasing animation cooldown');
            } else {
                this.animationCooldown = 100; // Normal cooldown
            }
        }
        
        this.lastAnimationTrigger = now;
        
        // Trigger frame switch for impact effect when typing
        const visualState = this.visualEngine.getVisualState();
        
        console.log('CodeQuest: triggerImpactFrame - Current state:', visualState.playerState, 'Current frame:', this.animationFrame);
        
        if (visualState.playerState === 'boss_battle') {
            // Boss battle: flash to Dragon 2 (frame 1) for impact
            this.animationFrame = 1;
            
            // Play boss hit sound
            if (this.soundManager) {
                this.soundManager.playBossHit(this._view?.webview);
            }
            
            // Return to Dragon 1 (frame 0) after brief flash
            setTimeout(() => {
                this.animationFrame = 0;
                this.refresh();
            }, 150); // 150ms flash duration
        } else if (visualState.playerState === 'fighting') {
            // Combat state: switch between 2 slime images (0, 1)
            const oldFrame = this.animationFrame;
            this.animationFrame = (this.animationFrame + 1) % 2;
            console.log('CodeQuest: Slime combat - Frame switched from', oldFrame, 'to', this.animationFrame);
            
            // Play combat hit sound
            if (this.soundManager) {
                this.soundManager.playCombatHit(this._view?.webview);
            }
        }
        // Idle state stays static (no frame switching)
        
        // Refresh the webview to show the new frame
        this.refresh();
    }

    private resetAnimationFrame() {
        // Reset animation frame when state changes to prevent getting stuck
        const visualState = this.visualEngine.getVisualState();
        console.log('CodeQuest: Resetting animation frame for state:', visualState.playerState);
        this.animationFrame = 0;
        this.refresh();
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

    private startIdleWizardTimer() {
        // Random wizard appearances in idle mode every 30-60 seconds
        const scheduleNextWizard = () => {
            const randomDelay = 30000 + Math.random() * 30000; // 30-60 seconds
            this.idleWizardTimer = setTimeout(() => {
                const visualState = this.visualEngine.getVisualState();
                if (visualState.playerState === 'idle') {
                    console.log('CodeQuest: Random wizard appearance in idle!');
                    // Temporarily activate wizard for 3 seconds
                    this.gameState.recordWizardActivity();
                    this.refresh();
                    
                    // Turn off wizard after 3 seconds
                    setTimeout(() => {
                        this.gameState.killWizardSession();
                        this.refresh();
                    }, 3000);
                }
                scheduleNextWizard(); // Schedule the next appearance
            }, randomDelay);
        };
        scheduleNextWizard();
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
            console.log('CodeQuest: Refreshing sidebar view...');
            // Force refresh of visual state before getting HTML
            this.visualEngine.getVisualState(); // This calls refreshVisualState internally
            
            // Check if player state changed and reset animation frame if needed
            const currentVisualState = this.visualEngine.getVisualState();
            if (this.lastPlayerState !== currentVisualState.playerState) {
                console.log('CodeQuest: Player state changed from', this.lastPlayerState, 'to', currentVisualState.playerState);
                this.animationFrame = 0; // Reset animation frame
                this.lastPlayerState = currentVisualState.playerState;
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
            
            // Check if wizard is present for AI assistance
            const isWizardActive = visualState.wizardPresent;
            console.log('CodeQuest: Boss battle - Wizard active?', isWizardActive, 'Visual state:', visualState);
            
            // Boss Battle state: choose between knight vs dragon or wizard vs dragon based on AI assistance
            const bossImages = isWizardActive ? [
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'AI V Dragon', 'Wizard V Dragon 1.png')
                ),
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'AI V Dragon', 'Wizard V Dragon 2.png')
                )
            ] : [
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Boss', 'Knight V Dragon 1.png')
                ),
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Boss', 'Knight V Dragon 2.png')
                )
            ];
            currentImage = bossImages[this.animationFrame % 2]?.toString() || '';
            console.log('CodeQuest: Selected boss image:', currentImage, 'Frame:', this.animationFrame);
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
            // Idle state: choose between knight or wizard based on AI assistance or random wizard
            const isWizardActive = visualState.wizardPresent;
            console.log('CodeQuest: Idle mode - Wizard active?', isWizardActive);
            
            const idleImages = isWizardActive ? [
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Idle', 'pixel art of a knight 2.png')
                )
            ] : [
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Idle', 'pixel art of a knight 1.png')
                )
            ];
            currentImage = idleImages[0]?.toString() || '';
            console.log('CodeQuest: Selected idle image:', currentImage);
            imageSection = ''; // No extra section needed for idle state
        } else if (isFighting) {
            // Combat state: choose between knight vs slime or wizard vs slime based on AI assistance
            const isWizardActive = visualState.wizardPresent;
            console.log('CodeQuest: Combat mode - Wizard active?', isWizardActive, 'Visual state:', visualState);
            
            const combatImages = isWizardActive ? [
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'AI V Slime', 'Wizard V Slime 1.png')
                ),
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'AI V Slime', 'Wizard V Slime 2.png')
                )
            ] : [
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Slime', 'Knight V Slime 1.png')
                ),
                this._view?.webview.asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'Assets', 'Slime', 'Knight V Slime 2.png')
                )
            ];
            currentImage = combatImages[this.animationFrame % 2]?.toString() || '';
            console.log('CodeQuest: Selected combat image:', currentImage, 'Frame:', this.animationFrame);
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
        
        // Sound effects system using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const soundLibrary = {
            'combat-hit': { frequency: 800, duration: 0.1, type: 'square' },
            'boss-hit': { frequency: 400, duration: 0.2, type: 'sawtooth' },
            'level-up': { frequency: 523.25, duration: 0.5, type: 'sine' }, // C5 note
            'achievement': { frequency: 659.25, duration: 0.3, type: 'sine' }, // E5 note
            'combo-milestone': { frequency: 783.99, duration: 0.2, type: 'sine' }, // G5 note
            'wizard-appear': { frequency: 880, duration: 0.3, type: 'triangle' } // A5 note
        };
        
        function playSound(soundName, volume = 0.5) {
            try {
                const sound = soundLibrary[soundName];
                if (!sound) {
                    console.log('CodeQuest: Unknown sound:', soundName);
                    return;
                }
                
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(sound.frequency, audioContext.currentTime);
                oscillator.type = sound.type;
                
                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(volume * 0.3, audioContext.currentTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + sound.duration);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + sound.duration);
                
                console.log('CodeQuest: Played sound:', soundName);
            } catch (error) {
                console.log('CodeQuest: Error playing sound:', error);
            }
        }
        
        // Handle multiplier display messages
        window.addEventListener('message', event => {
            const message = event.data;
            const container = document.getElementById('multiplierContainer');
            const knightImage = document.getElementById('knightImage');
            
            switch (message.type) {
                case 'playSound':
                    playSound(message.soundName, message.volume);
                    break;
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
