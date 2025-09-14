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
    private idleWizardTimer?: NodeJS.Timeout;
    private lastPlayerState: string = '';
    
    // Rate limiting for animations - Memory optimized
    private lastAnimationTrigger: number = 0;
    private animationCooldown: number = 100; // Minimum 100ms between animations
    
    // Memory-efficient circular buffer for typing velocity
    private typingVelocityTracker: Float64Array;
    private typingVelocityIndex: number = 0;
    private readonly MAX_VELOCITY_SAMPLES = 10;
    private lastTypingTime: number = 0;
    
    // Disposables for cleanup - use Set for O(1) operations
    private disposables: Set<NodeJS.Timeout> = new Set();
    
    // Debounced refresh for performance
    private refreshPending: boolean = false;
    private lastRefreshTime: number = 0;
    private readonly REFRESH_COOLDOWN = 50; // Minimum 50ms between refreshes
    
    // Timer management helper methods
    private addTimer(timer: NodeJS.Timeout): void {
        this.disposables.add(timer);
    }
    
    private removeTimer(timer: NodeJS.Timeout): void {
        clearTimeout(timer);
        this.disposables.delete(timer);
    }
    
    private clearAllTimers(): void {
        this.disposables.forEach(timer => clearTimeout(timer));
        this.disposables.clear();
    }
    
    // Memory-efficient lazy loading image cache
    private cachedImageUris: Map<string, string> = new Map();
    private loadingImages: Set<string> = new Set();
    
    // Lazy loading: Only cache images when actually needed
    private getImageUri(key: string, path: string[]): string {
        // Return from cache if available
        if (this.cachedImageUris.has(key)) {
            return this.cachedImageUris.get(key)!;
        }
        
        // If already loading, return empty string temporarily
        if (this.loadingImages.has(key)) {
            return '';
        }
        
        // Mark as loading and create URI
        this.loadingImages.add(key);
        
        if (this._view?.webview) {
            const uri = this._view.webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, ...path)
            ).toString();
            
            // Cache the result
            this.cachedImageUris.set(key, uri);
            this.loadingImages.delete(key);
            
            return uri;
        }
        
        this.loadingImages.delete(key);
        return '';
    }
    
    // Preload critical images on demand
    private preloadCriticalImages(): void {
        // Only preload most commonly used images
        const criticalImages = [
            { key: 'knight_idle_1', path: ['Assets', 'Idle', 'pixel art of a knight 1.png'] },
            { key: 'knight_slime_1', path: ['Assets', 'Slime', 'Knight V Slime 1.png'] }
        ];
        
        // Use requestIdleCallback simulation for non-blocking preload
        setTimeout(() => {
            for (const config of criticalImages) {
                this.getImageUri(config.key, config.path);
            }
        }, 100); // Small delay to not block initial rendering
    }

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private gameState: GameState
    ) {
        // Initialize memory-efficient data structures
        this.typingVelocityTracker = new Float64Array(this.MAX_VELOCITY_SAMPLES);
        
        // Remove excessive debug logging for performance
        // console.log('CodeQuest: SidebarProvider constructor called');
        
        try {
            this.visualEngine = new VisualEngine(gameState);
            // console.log('CodeQuest: VisualEngine created successfully');
        } catch (error) {
            console.error('CodeQuest: Error creating VisualEngine:', error);
        }        try {
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

    // Add disposal method for cleanup
    dispose() {
        // Clear all timers efficiently
        this.clearAllTimers();
        
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = undefined;
        }
        
        if (this.idleWizardTimer) {
            clearTimeout(this.idleWizardTimer);
            this.idleWizardTimer = undefined;
        }
        
        // Clean up the view
        this._view = undefined;
        
        // Dispose visual engine to prevent memory leaks
        if (this.visualEngine) {
            this.visualEngine.dispose();
        }
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
            return; // Skip logging for performance
        }
        
        // Track typing velocity using circular buffer for memory efficiency
        this.typingVelocityTracker[this.typingVelocityIndex] = now;
        this.typingVelocityIndex = (this.typingVelocityIndex + 1) % this.MAX_VELOCITY_SAMPLES;
        
        // Calculate WPM if we have enough data points
        let validSamples = 0;
        let oldestTime = now;
        for (let i = 0; i < this.MAX_VELOCITY_SAMPLES; i++) {
            if (this.typingVelocityTracker[i] > 0) {
                validSamples++;
                if (this.typingVelocityTracker[i] < oldestTime) {
                    oldestTime = this.typingVelocityTracker[i];
                }
            }
        }
        
        if (validSamples >= 5) {
            const timeSpan = now - oldestTime;
            const wpm = (validSamples * 60000) / (timeSpan * 5); // Rough WPM calculation
            
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
        
        // Remove excessive logging for performance in production
        // console.log('CodeQuest: triggerImpactFrame - Current state:', visualState.playerState, 'Current frame:', this.animationFrame);
        
        if (visualState.playerState === 'boss_battle') {
            // Boss battle: flash to Dragon 2 (frame 1) for impact
            this.animationFrame = 1;
            
            // Return to Dragon 1 (frame 0) after brief flash
            const flashTimer = setTimeout(() => {
                this.animationFrame = 0;
                this.refresh();
            }, 400); // 400ms flash duration (increased from 150ms)
            this.addTimer(flashTimer);
        } else if (visualState.playerState === 'fighting') {
            // Combat state: flash to Slime 2 (frame 1) for impact, then return to Slime 1 (frame 0)
            this.animationFrame = 1; // Flash to impact frame
            
            // Return to normal frame after brief flash
            const flashTimer = setTimeout(() => {
                this.animationFrame = 0;
                this.refresh();
            }, 400); // 400ms flash duration (increased from 150ms)
            this.addTimer(flashTimer);
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

        // Generate CHAOTIC random position and rotation
        const randomX = Math.random() * 80 + 10; // 10% to 90% from left (wider range)
        const randomY = Math.random() * 80 + 10; // 10% to 90% from top (wider range)
        const randomRotation = Math.random() * 360; // 0 to 360 degrees (full rotation)
        
        // Add some chaos to the multiplier text
        const chaosText = Math.random() > 0.7 ? '!!!' : Math.random() > 0.5 ? '!!' : '!';
        const displayText = `${multiplier}x${chaosText}`;

        // Update webview if it exists
        if (this._view) {
            this._view.webview.postMessage({
                type: 'showMultiplier',
                multiplier: displayText, // Use chaotic text instead of just number
                combo: combo,
                position: { x: randomX, y: randomY },
                rotation: randomRotation
            });
        }

        // Note: Each multiplier now manages its own lifecycle (6 seconds)
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
                    // Temporarily activate wizard for 15 seconds
                    this.gameState.recordWizardActivity();
                    this.refresh();
                    
                    // Turn off wizard after 15 seconds
                    const wizardTimer = setTimeout(() => {
                        this.gameState.killWizardSession();
                        this.refresh();
                    }, 15000);
                    this.addTimer(wizardTimer);
                }
                scheduleNextWizard(); // Schedule the next appearance
            }, randomDelay);
            
            // Track this timer for cleanup
            if (this.idleWizardTimer) {
                this.addTimer(this.idleWizardTimer);
            }
        };
        scheduleNextWizard();
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        console.log('CodeQuest: resolveWebviewView called! This means webview is working!');
        vscode.window.showInformationMessage('🎮 CodeQuest: WebView resolveWebviewView called!');
        this._view = webviewView;
        
        // Initialize cached URIs now that webview is available
        // Enable lazy loading instead of pre-caching all images
        this.preloadCriticalImages();

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
        // Performance optimization: Debounced refresh to prevent excessive DOM updates
        const now = Date.now();
        
        if (this.refreshPending || (now - this.lastRefreshTime) < this.REFRESH_COOLDOWN) {
            // If refresh is already pending or too soon, skip this one
            if (!this.refreshPending) {
                this.refreshPending = true;
                const refreshTimer = setTimeout(() => {
                    this.refreshPending = false;
                    this.performRefresh();
                }, this.REFRESH_COOLDOWN);
                this.addTimer(refreshTimer);
            }
            return;
        }
        
        this.performRefresh();
    }
    
    private performRefresh() {
        this.lastRefreshTime = Date.now();
        
        if (this._view) {
            console.log('CodeQuest: Refreshing sidebar view...');
            // Get visual state once - this calls refreshVisualState internally
            const currentVisualState = this.visualEngine.getVisualState();
            
            // Check if player state changed and reset animation frame if needed
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
        
        // Calculate level tier and display
        let levelIcon = '🏆';
        let levelTitle = 'NOVICE';
        let levelClass = 'level-novice';
        
        if (stats.level >= 50) {
            levelIcon = '👑';
            levelTitle = 'LEGEND';
            levelClass = 'level-legend';
        } else if (stats.level >= 25) {
            levelIcon = '💎';
            levelTitle = 'MASTER';
            levelClass = 'level-master';
        } else if (stats.level >= 10) {
            levelIcon = '⭐';
            levelTitle = 'EXPERT';
            levelClass = 'level-expert';
        }
        
        // Calculate combo tier and visual effects
        let comboIcon = '🔥';
        let comboTitle = 'COMBO';
        let comboClass = 'combo-normal';
        let comboBarClass = 'combo-bar-normal';
        let comboWidth = Math.min(100, (stats.combo / 100) * 100); // Cap at 100 for display
        
        if (stats.combo > 50) {
            comboIcon = '🌟';
            comboTitle = 'MEGA COMBO';
            comboClass = 'combo-mega';
            comboBarClass = 'combo-bar-mega';
        } else if (stats.combo > 20) {
            comboIcon = '⚡';
            comboTitle = 'SUPER COMBO';
            comboClass = 'combo-super';
            comboBarClass = 'combo-bar-super';
        } else if (stats.combo > 10) {
            comboIcon = '🔥';
            comboTitle = 'HOT COMBO';
            comboClass = 'combo-hot';
            comboBarClass = 'combo-bar-hot';
        }
        
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
                this.getImageUri('wizard_dragon_1', ['Assets', 'AI V Dragon', 'Wizard V Dragon 1.png']),
                this.getImageUri('wizard_dragon_2', ['Assets', 'AI V Dragon', 'Wizard V Dragon 2.png'])
            ] : [
                this.getImageUri('knight_dragon_1', ['Assets', 'Boss', 'Knight V Dragon 1.png']),
                this.getImageUri('knight_dragon_2', ['Assets', 'Boss', 'Knight V Dragon 2.png'])
            ];
            currentImage = bossImages[this.animationFrame % 2] || '';
            // Remove excessive debug logging for performance
            // console.log('CodeQuest: Selected boss image:', currentImage, 'Frame:', this.animationFrame);
            
            // Calculate progress percentage
            const progressPercentage = currentBoss ? Math.min(100, (currentBoss.currentLines / currentBoss.targetLines) * 100) : 0;
            
            // Generate subtasks HTML for boss battles - optimized for performance
            if (currentBoss?.subtasks && currentBoss.subtasks.length > 0) {
                // More efficient: direct string concatenation without intermediate array
                let subtasksHtml = '';
                for (const subtask of currentBoss.subtasks) {
                    subtasksHtml += `
                            <div class="subtask ${subtask.completed ? 'completed' : ''}">
                                <input type="checkbox" 
                                       id="${subtask.id}" 
                                       ${subtask.completed ? 'checked' : ''} 
                                       onchange="toggleSubtask('${subtask.id}')" />
                                <label for="${subtask.id}">${subtask.description}</label>
                            </div>`;
                }
                
                imageSection = `
                    <div class="boss-section">
                        <div class="boss-header">
                            <div class="boss-title">🐉 Boss Battle: ${currentBoss.name || 'Dragon'}</div>
                        </div>
                        <div class="boss-progress-container">
                            <div class="boss-progress-bar" style="width: ${progressPercentage}%"></div>
                            <div class="boss-progress-text">${currentBoss.currentLines}/${currentBoss.targetLines} lines</div>
                        </div>
                        <div class="subtasks-container">
                            <h4 style="margin: 0 0 10px 0; color: #9400D3; font-size: 14px;">📋 Quest Objectives:</h4>
                            ${subtasksHtml}
                        </div>
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
                this.getImageUri('knight_idle_2', ['Assets', 'Idle', 'pixel art of a knight 2.png'])
            ] : [
                this.getImageUri('knight_idle_1', ['Assets', 'Idle', 'pixel art of a knight 1.png'])
            ];
            currentImage = idleImages[0] || '';
            console.log('CodeQuest: Selected idle image:', currentImage);
            imageSection = ''; // No extra section needed for idle state
        } else if (isFighting) {
            // Combat state: choose between knight vs slime or wizard vs slime based on AI assistance
            const isWizardActive = visualState.wizardPresent;
            console.log('CodeQuest: Combat mode - Wizard active?', isWizardActive, 'Visual state:', visualState);
            
            const combatImages = isWizardActive ? [
                this.getImageUri('wizard_slime_1', ['Assets', 'AI V Slime', 'Wizard V Slime 1.png']),
                this.getImageUri('wizard_slime_2', ['Assets', 'AI V Slime', 'Wizard V Slime 2.png'])
            ] : [
                this.getImageUri('knight_slime_1', ['Assets', 'Slime', 'Knight V Slime 1.png']),
                this.getImageUri('knight_slime_2', ['Assets', 'Slime', 'Knight V Slime 2.png'])
            ];
            currentImage = combatImages[this.animationFrame % 2] || '';
            console.log('CodeQuest: Selected combat image:', currentImage, 'Frame:', this.animationFrame);
            imageSection = ''; // No extra section needed for combat state
        } else {
            // Default state - set a test image
            currentImage = this.getImageUri('knight_idle_1', ['Assets', 'Idle', 'pixel art of a knight 1.png']);
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
            animation: chaoticShake 1.2s ease-in-out; /* Even longer and more chaotic */
        }
        @keyframes chaoticShake {
            0%, 100% { transform: translateX(0) rotate(0deg); }
            5% { transform: translateX(-12px) translateY(-8px) rotate(-2deg); }
            10% { transform: translateX(15px) translateY(6px) rotate(3deg); }
            15% { transform: translateX(-10px) translateY(-4px) rotate(-1deg); }
            20% { transform: translateX(12px) translateY(8px) rotate(2deg); }
            25% { transform: translateX(-8px) translateY(-6px) rotate(-3deg); }
            30% { transform: translateX(10px) translateY(4px) rotate(1deg); }
            35% { transform: translateX(-14px) translateY(-2px) rotate(-2deg); }
            40% { transform: translateX(8px) translateY(7px) rotate(2deg); }
            45% { transform: translateX(-6px) translateY(-5px) rotate(-1deg); }
            50% { transform: translateX(9px) translateY(3px) rotate(3deg); }
            55% { transform: translateX(-11px) translateY(-7px) rotate(-2deg); }
            60% { transform: translateX(7px) translateY(5px) rotate(1deg); }
            65% { transform: translateX(-5px) translateY(-3px) rotate(-1deg); }
            70% { transform: translateX(6px) translateY(4px) rotate(2deg); }
            75% { transform: translateX(-4px) translateY(-2px) rotate(-1deg); }
            80% { transform: translateX(4px) translateY(2px) rotate(1deg); }
            85% { transform: translateX(-3px) translateY(-1px) rotate(-1deg); }
            90% { transform: translateX(2px) translateY(1px) rotate(1deg); }
            95% { transform: translateX(-1px) translateY(-1px) rotate(0deg); }
        }
        .multiplier-overlay {
            position: absolute;
            color: #FFD700;
            font-weight: bold;
            font-size: 32px;
            text-shadow: 
                0 0 15px #FFD700,
                0 0 30px #FFD700,
                0 0 45px #FFD700,
                0 0 60px #FFD700,
                0 0 75px #FFD700,
                3px 3px 6px rgba(0, 0, 0, 1);
            opacity: 0;
            transform: scale(0.5);
            transition: all 0.3s ease;
            z-index: 10;
            pointer-events: none;
            font-family: 'Impact', 'Arial Black', sans-serif;
        }
        .multiplier-overlay.show {
            opacity: 1;
            transform: scale(1);
            animation: chaoticPulse 0.4s infinite alternate, colorShift 1.5s infinite;
        }
        @keyframes chaoticPulse {
            0% { 
                transform: scale(1) rotate(0deg); 
                text-shadow: 
                    0 0 15px #FFD700,
                    0 0 30px #FFD700,
                    0 0 45px #FFD700;
            }
            25% { 
                transform: scale(1.3) rotate(5deg); 
                text-shadow: 
                    0 0 25px #FF0080,
                    0 0 40px #FF0080,
                    0 0 55px #FF0080;
            }
            50% { 
                transform: scale(0.9) rotate(-3deg); 
                text-shadow: 
                    0 0 20px #00FFFF,
                    0 0 35px #00FFFF,
                    0 0 50px #00FFFF;
            }
            75% { 
                transform: scale(1.4) rotate(7deg); 
                text-shadow: 
                    0 0 30px #FF4500,
                    0 0 45px #FF4500,
                    0 0 60px #FF4500;
            }
            100% { 
                transform: scale(1.1) rotate(-2deg); 
                text-shadow: 
                    0 0 35px #9400D3,
                    0 0 50px #9400D3,
                    0 0 65px #9400D3;
            }
        }
        @keyframes colorShift {
            0% { color: #FFD700; }
            20% { color: #FF0080; }
            40% { color: #00FFFF; }
            60% { color: #FF4500; }
            80% { color: #9400D3; }
            100% { color: #FFD700; }
        }
        
        @keyframes woodenPulse {
            0% { 
                transform: scale(1) rotate(-1deg); 
                box-shadow: 
                    inset 1px 1px 2px rgba(210, 180, 140, 0.3),
                    4px 4px 8px rgba(0, 0, 0, 0.8);
            }
            100% { 
                transform: scale(1.05) rotate(1deg); 
                box-shadow: 
                    inset 1px 1px 2px rgba(210, 180, 140, 0.4),
                    6px 6px 12px rgba(0, 0, 0, 0.9);
            }
        }
        
        @keyframes goldenGlow {
            0% { 
                text-shadow: 
                    2px 2px 4px rgba(0, 0, 0, 1),
                    0 0 15px #FFD700,
                    0 0 25px #CD853F;
            }
            50% { 
                text-shadow: 
                    2px 2px 4px rgba(0, 0, 0, 1),
                    0 0 20px #FFD700,
                    0 0 35px #CD853F,
                    0 0 45px #8B4513;
            }
            100% { 
                text-shadow: 
                    2px 2px 4px rgba(0, 0, 0, 1),
                    0 0 15px #FFD700,
                    0 0 25px #CD853F;
            }
        }
        .combo-display {
            font-size: 16px;
            margin: 10px 0;
            color: #FFD700;
            font-weight: bold;
        }
        
        /* Visual Combo Meter - Wooden Sign Style */
        .combo-container {
            background: 
                linear-gradient(145deg, #654321 0%, #8B4513 30%, #654321 70%, #5D4E37 100%);
            border: 4px solid #5D4E37;
            border-radius: 12px;
            padding: 16px;
            margin: 15px 0;
            position: relative;
            box-shadow: 
                inset 2px 2px 4px rgba(139, 69, 19, 0.3),
                inset -2px -2px 4px rgba(93, 78, 55, 0.8),
                4px 4px 8px rgba(0, 0, 0, 0.6);
            /* Wood grain texture */
            background-image: 
                repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 2px,
                    rgba(93, 78, 55, 0.15) 2px,
                    rgba(93, 78, 55, 0.15) 4px
                );
        }
        
        /* Rope binding details for combo sign */
        .combo-container::before {
            content: '';
            position: absolute;
            top: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 60px;
            height: 8px;
            background: 
                linear-gradient(90deg, #8B4513 0%, #D2691E 50%, #8B4513 100%);
            border-radius: 4px;
            box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }
        
        .combo-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .combo-title {
            font-weight: bold;
            font-size: 14px;
            color: #F5DEB3;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
            font-family: 'Courier New', monospace;
        }
        
        .combo-value {
            font-size: 20px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9);
            font-family: 'Courier New', monospace;
        }
        
        .combo-normal { color: #FFA500; }
        .combo-hot { color: #FF4500; animation: comboHot 2s ease-in-out infinite alternate; } /* Slowed from 1s */
        .combo-super { color: #FF1493; animation: comboSuper 1.5s ease-in-out infinite alternate; } /* Slowed from 0.8s */
        .combo-mega { color: #00FFFF; animation: comboMega 1.2s ease-in-out infinite alternate; } /* Slowed from 0.6s */
        
        @keyframes comboHot {
            0% { transform: scale(1); text-shadow: 0 0 8px currentColor; }
            100% { transform: scale(1.05); text-shadow: 0 0 15px currentColor, 0 0 25px currentColor; }
        }
        
        @keyframes comboSuper {
            0% { transform: scale(1) rotate(-1deg); text-shadow: 0 0 10px currentColor; }
            100% { transform: scale(1.1) rotate(1deg); text-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
        }
        
        @keyframes comboMega {
            0% { transform: scale(1) rotate(-2deg); text-shadow: 0 0 15px currentColor; }
            100% { transform: scale(1.15) rotate(2deg); text-shadow: 0 0 25px currentColor, 0 0 35px currentColor, 0 0 45px currentColor; }
        }
        
        .combo-bar-container {
            background: 
                linear-gradient(145deg, #2F1B14 0%, #5D4E37 50%, #2F1B14 100%);
            border: 2px solid #5D4E37;
            border-radius: 8px;
            height: 16px;
            overflow: hidden;
            position: relative;
            margin-top: 8px;
            box-shadow: 
                inset 2px 2px 4px rgba(93, 78, 55, 0.8),
                inset -1px -1px 2px rgba(139, 69, 19, 0.3);
        }
        
        .combo-bar {
            height: 100%;
            border-radius: 6px;
            transition: width 0.3s ease-out;
            position: relative;
            box-shadow: 
                inset 1px 1px 2px rgba(255, 255, 255, 0.3),
                inset -1px -1px 2px rgba(0, 0, 0, 0.4);
        }
        
        .combo-bar-normal {
            background: 
                linear-gradient(90deg, 
                    #CD853F 0%, 
                    #DEB887 50%, 
                    #CD853F 100%);
        }
        
        .combo-bar-hot {
            background: 
                linear-gradient(90deg, 
                    #FF4500 0%, 
                    #FF6347 25%, 
                    #FFA500 50%, 
                    #FF6347 75%, 
                    #FF4500 100%);
            animation: comboBarPulse 2s ease-in-out infinite alternate;
        }
        
        .combo-bar-super {
            background: 
                linear-gradient(90deg, 
                    #FF1493 0%, 
                    #FF69B4 25%, 
                    #FFB6C1 50%, 
                    #FF69B4 75%, 
                    #FF1493 100%);
            animation: comboBarPulse 1.5s ease-in-out infinite alternate;
        }
        
        .combo-bar-mega {
            background: 
                linear-gradient(90deg, 
                    #00FFFF 0%, 
                    #40E0D0 25%, 
                    #00CED1 50%, 
                    #20B2AA 75%, 
                    #00FFFF 100%);
            animation: comboBarIntense 1.2s ease-in-out infinite alternate;
        }
        
        @keyframes comboBarPulse {
            0% { 
                box-shadow: 
                    inset 1px 1px 2px rgba(255, 255, 255, 0.3),
                    0 0 8px rgba(255, 69, 0, 0.5); 
            }
            100% { 
                box-shadow: 
                    inset 1px 1px 2px rgba(255, 255, 255, 0.3),
                    0 0 16px rgba(255, 69, 0, 0.8), 
                    0 0 24px rgba(255, 69, 0, 0.4); 
            }
        }
        
        @keyframes comboBarIntense {
            0% { 
                box-shadow: 
                    inset 1px 1px 2px rgba(255, 255, 255, 0.3),
                    0 0 10px rgba(0, 255, 255, 0.6); 
            }
            100% { 
                box-shadow: 
                    inset 1px 1px 2px rgba(255, 255, 255, 0.3),
                    0 0 20px rgba(0, 255, 255, 1), 
                    0 0 30px rgba(0, 255, 255, 0.6), 
                    0 0 40px rgba(0, 255, 255, 0.3); 
            }
        }
        .action-buttons {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 20px;
        }
        .action-button {
            background: 
                linear-gradient(145deg, #8B4513 0%, #CD853F 30%, #8B4513 70%, #654321 100%);
            color: #F5DEB3;
            border: 3px solid #654321;
            padding: 14px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            font-family: 'Courier New', monospace;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
            transition: all 0.3s ease;
            position: relative;
            box-shadow: 
                inset 2px 2px 4px rgba(205, 133, 63, 0.4),
                inset -2px -2px 4px rgba(101, 67, 33, 0.8),
                4px 4px 8px rgba(0, 0, 0, 0.6);
            /* Wood grain texture */
            background-image: 
                repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 2px,
                    rgba(101, 67, 33, 0.1) 2px,
                    rgba(101, 67, 33, 0.1) 4px
                );
        }
        
        .action-button:hover {
            background: 
                linear-gradient(145deg, #A0522D 0%, #DEB887 30%, #A0522D 70%, #8B4513 100%);
            transform: translateY(-2px);
            box-shadow: 
                inset 2px 2px 4px rgba(222, 184, 135, 0.5),
                inset -2px -2px 4px rgba(139, 69, 19, 0.8),
                6px 6px 12px rgba(0, 0, 0, 0.7);
        }
        
        .action-button:active {
            transform: translateY(1px);
            box-shadow: 
                inset 3px 3px 6px rgba(101, 67, 33, 0.9),
                inset -1px -1px 2px rgba(205, 133, 63, 0.3),
                2px 2px 4px rgba(0, 0, 0, 0.5);
        }
        
        .action-button:disabled {
            background: 
                linear-gradient(145deg, #696969 0%, #808080 30%, #696969 70%, #555555 100%);
            color: #C0C0C0;
            cursor: not-allowed;
            opacity: 0.6;
            transform: none;
            box-shadow: 
                inset 1px 1px 2px rgba(128, 128, 128, 0.3),
                inset -1px -1px 2px rgba(85, 85, 85, 0.8),
                2px 2px 4px rgba(0, 0, 0, 0.4);
        }
        .boss-section {
            background: 
                radial-gradient(ellipse at center, #8B0000 0%, #654321 30%, #2F1B14 100%);
            border: 4px solid #8B0000;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            position: relative;
            box-shadow: 
                inset 0 0 20px rgba(139, 0, 0, 0.3),
                inset 2px 2px 4px rgba(139, 69, 19, 0.2),
                inset -2px -2px 4px rgba(47, 27, 20, 0.8),
                0 8px 16px rgba(0, 0, 0, 0.8);
            /* Dark wood grain */
            background-image: 
                repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 3px,
                    rgba(139, 0, 0, 0.1) 3px,
                    rgba(139, 0, 0, 0.1) 6px
                );
        }
        
        /* Iron corner reinforcements for boss section */
        .boss-section::before,
        .boss-section::after {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            background: 
                radial-gradient(circle, #2C2C2C 0%, #1A1A1A 50%, #000000 100%);
            border: 2px solid #444444;
        }
        
        .boss-section::before {
            top: -2px;
            left: -2px;
            border-radius: 0 0 6px 0;
        }
        
        .boss-section::after {
            top: -2px;
            right: -2px;
            border-radius: 0 0 0 6px;
        }
        
        .boss-header {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 15px;
            text-align: center;
        }
        
        .boss-title {
            color: #FFD700;
            font-size: 18px;
            font-weight: bold;
            text-shadow: 
                2px 2px 4px rgba(0, 0, 0, 0.9),
                0 0 10px rgba(255, 215, 0, 0.5);
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
        }
        
        .boss-progress-container {
            background: 
                linear-gradient(145deg, #8B4513 0%, #CD853F 50%, #8B4513 100%);
            border: 2px solid #654321;
            border-radius: 6px;
            height: 25px;
            margin: 10px 0;
            position: relative;
            overflow: hidden;
            box-shadow: 
                inset 2px 2px 4px rgba(101, 67, 33, 0.8),
                inset -2px -2px 4px rgba(205, 133, 63, 0.3);
        }
        
        .boss-progress-bar {
            background: 
                linear-gradient(to right, #8B0000 0%, #DC143C 50%, #8B0000 100%);
            height: 100%;
            transition: width 0.5s ease;
            border-radius: 4px;
            position: relative;
            /* Pulsing glow effect */
            box-shadow: 
                0 0 10px rgba(220, 20, 60, 0.8),
                inset 0 2px 4px rgba(255, 255, 255, 0.2);
        }
        
        .boss-progress-bar::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
            animation: bossShimmer 1.5s infinite;
        }
        
        @keyframes bossShimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        .boss-progress-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #F5DEB3;
            font-weight: bold;
            font-size: 12px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9);
            z-index: 10;
        }
        
        .subtasks-container {
            margin-top: 15px;
            background: rgba(101, 67, 33, 0.3);
            border-radius: 8px;
            padding: 12px;
            border: 2px solid rgba(139, 69, 19, 0.5);
        }
        
        .subtask {
            display: flex;
            align-items: center;
            margin: 8px 0;
            padding: 10px;
            background: 
                linear-gradient(145deg, rgba(139, 69, 19, 0.4) 0%, rgba(101, 67, 33, 0.6) 100%);
            border-radius: 6px;
            border-left: 4px solid #8B4513;
            transition: all 0.3s ease;
            box-shadow: 
                inset 1px 1px 2px rgba(210, 180, 140, 0.2),
                2px 2px 4px rgba(0, 0, 0, 0.4);
        }
        
        .subtask:hover {
            background: 
                linear-gradient(145deg, rgba(139, 69, 19, 0.6) 0%, rgba(101, 67, 33, 0.8) 100%);
            transform: translateX(3px);
            box-shadow: 
                inset 1px 1px 2px rgba(210, 180, 140, 0.3),
                4px 4px 6px rgba(0, 0, 0, 0.5);
        }
        
        .subtask.completed {
            background: 
                linear-gradient(145deg, rgba(34, 139, 34, 0.4) 0%, rgba(46, 125, 50, 0.6) 100%);
            border-left-color: #228B22;
        }
        
        .subtask input {
            margin-right: 12px;
            transform: scale(1.3);
            accent-color: #8B4513;
        }
        
        .subtask label {
            flex: 1;
            cursor: pointer;
            font-size: 13px;
            color: #F5DEB3;
            font-family: 'Courier New', monospace;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        }
        
        .subtask.completed label {
            text-decoration: line-through;
            color: rgba(245, 222, 179, 0.6);
        }
        
        /* Visual Stats Display - Wooden Sign Style */
        .stats-container {
            background: 
                linear-gradient(145deg, #8B4513 0%, #D2691E  30%, #8B4513 70%, #654321 100%);
            border: 4px solid #654321;
            border-radius: 12px;
            padding: 16px;
            margin: 15px 0;
            position: relative;
            box-shadow: 
                inset 2px 2px 4px rgba(210, 180, 140, 0.3),
                inset -2px -2px 4px rgba(101, 67, 33, 0.8),
                4px 4px 8px rgba(0, 0, 0, 0.6);
            /* Wood grain texture */
            background-image: 
                repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 2px,
                    rgba(101, 67, 33, 0.1) 2px,
                    rgba(101, 67, 33, 0.1) 4px
                );
        }
        
        /* Metal nail details on wooden signs */
        .stats-container::before {
            content: '';
            position: absolute;
            top: 8px;
            left: 8px;
            width: 8px;
            height: 8px;
            background: radial-gradient(circle, #C0C0C0 30%, #808080 70%);
            border-radius: 50%;
            box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
        }
        
        .stats-container::after {
            content: '';
            position: absolute;
            top: 8px;
            right: 8px;
            width: 8px;
            height: 8px;
            background: radial-gradient(circle, #C0C0C0 30%, #808080 70%);
            border-radius: 50%;
            box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
        }
        
        .stat-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 12px 0;
            padding: 8px 12px;
            background: rgba(101, 67, 33, 0.2);
            border-radius: 8px;
            border: 1px solid rgba(210, 180, 140, 0.3);
        }
        
        .stat-label {
            font-weight: bold;
            min-width: 60px;
            color: #F5DEB3;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }
        
        .level-display {
            font-size: 18px;
            font-weight: bold;
            color: #FFD700;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-family: 'Courier New', monospace;
        }
        
        .level-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border-radius: 4px;
            border: 3px solid;
            background: 
                linear-gradient(145deg, #8B4513 0%, #D2691E 50%, #8B4513 100%);
            box-shadow: 
                inset 1px 1px 2px rgba(210, 180, 140, 0.5),
                inset -1px -1px 2px rgba(101, 67, 33, 0.8),
                2px 2px 4px rgba(0, 0, 0, 0.6);
            font-family: 'Courier New', monospace;
            font-weight: bold;
        }
        
        .level-novice {
            border-color: #8B4513;
            color: #D2B48C;
            text-shadow: 0 0 5px rgba(210, 180, 140, 0.5);
        }
        
        .level-expert {
            border-color: #4169E1;
            color: #87CEEB;
            text-shadow: 0 0 8px rgba(135, 206, 235, 0.5);
        }
        
        .level-master {
            border-color: #9400D3;
            color: #DDA0DD;
            text-shadow: 0 0 10px rgba(221, 160, 221, 0.7);
        }
        
        .level-legend {
            border-color: #FFD700;
            color: #FFD700;
            text-shadow: 0 0 15px rgba(255, 215, 0, 0.8);
            background: linear-gradient(45deg, rgba(255,215,0,0.2), rgba(255,255,255,0.1));
        }
        
        @keyframes levelGlow {
            0% { box-shadow: 0 0 5px rgba(255, 215, 0, 0.3); }
            100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.6), 0 0 30px rgba(255, 215, 0, 0.3); }
        }
        
        /* Flashy Number Styles */
        .flashy-number {
            font-weight: bold;
            font-size: 16px;
            text-shadow: 0 0 10px currentColor;
            animation: numberPulse 3s ease-in-out infinite alternate; /* Slowed from 2s */
        }
        
        .streak-glow {
            color: #FFD700;
            text-shadow: 0 0 15px #FFD700, 0 0 25px #FFD700;
        }
        
        .max-combo-glow {
            color: #FF1493;
            text-shadow: 0 0 15px #FF1493, 0 0 25px #FF1493;
            animation: maxComboPulse 2.5s ease-in-out infinite alternate; /* Slowed from 1.5s */
        }
        
        .lines-glow {
            color: #00BFFF;
            text-shadow: 0 0 15px #00BFFF, 0 0 25px #00BFFF;
            animation: linesPulse 4s ease-in-out infinite alternate; /* Slowed from 2.5s */
        }
        
        .bosses-glow {
            color: #9400D3;
            text-shadow: 0 0 15px #9400D3, 0 0 25px #9400D3, 0 0 35px #9400D3;
            animation: bossGlow 3.5s ease-in-out infinite alternate; /* Slowed from 1.8s */
        }
        
        @keyframes numberPulse {
            0% { transform: scale(1); }
            100% { transform: scale(1.05); }
        }
        
        @keyframes maxComboPulse {
            0% { transform: scale(1) rotate(-1deg); }
            100% { transform: scale(1.08) rotate(1deg); }
        }
        
        @keyframes linesPulse {
            0% { opacity: 0.9; transform: scale(1); }
            100% { opacity: 1; transform: scale(1.03); }
        }
        
        @keyframes bossGlow {
            0% { transform: scale(1); text-shadow: 0 0 15px #9400D3; }
            100% { transform: scale(1.1); text-shadow: 0 0 25px #9400D3, 0 0 35px #9400D3, 0 0 45px #9400D3; }
        }
        
        /* XP Progress Bar - Wooden Style */
        .xp-bar-container {
            flex: 1;
            margin: 0 12px;
            background: 
                linear-gradient(145deg, #2F1B14 0%, #654321 50%, #2F1B14 100%);
            border: 2px solid #654321;
            border-radius: 8px;
            height: 24px;
            overflow: hidden;
            position: relative;
            box-shadow: 
                inset 2px 2px 4px rgba(101, 67, 33, 0.8),
                inset -1px -1px 2px rgba(210, 180, 140, 0.3);
        }
        
        .xp-bar {
            height: 100%;
            background: 
                linear-gradient(90deg, 
                    #FFD700 0%, 
                    #FFA500 25%, 
                    #FF8C00 50%, 
                    #FF6347 75%, 
                    #FFD700 100%);
            border-radius: 6px;
            transition: width 0.8s ease-out;
            position: relative;
            overflow: hidden;
            box-shadow: 
                inset 1px 1px 2px rgba(255, 255, 255, 0.4),
                inset -1px -1px 2px rgba(0, 0, 0, 0.3);
        }
        
        .xp-bar::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 4px,
                    rgba(255, 255, 255, 0.2) 4px,
                    rgba(255, 255, 255, 0.2) 8px
                );
            animation: shimmer 3s infinite;
        }
        
        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        .xp-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 11px;
            font-weight: bold;
            color: #F5DEB3;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
            z-index: 1;
            font-family: 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="knight-container">
        <img id="knightImage" src="${currentImage}" alt="Knight" class="game-image" />
        <div id="multiplierContainer"></div>
    </div>
    
    <!-- Visual Stats Display -->
    <div class="stats-container">
        <div class="stat-row">
            <div class="level-display">
                <div class="level-badge ${levelClass}">
                    ${levelIcon} ${levelTitle} ${stats.level}
                </div>
            </div>
        </div>
        <div class="stat-row">
            <span class="stat-label">⭐ XP:</span>
            <div class="xp-bar-container">
                <div class="xp-bar" style="width: ${xpPercentage}%"></div>
                <div class="xp-text">${stats.xp}/${stats.xpToNextLevel}</div>
            </div>
        </div>
        <div class="stat-row">
            <span class="stat-label">📈 Streak:</span>
            <span class="flashy-number streak-glow">${stats.dailyStreak} days</span>
        </div>
    </div>
    
    <!-- Additional Stats Display -->
    <div class="stats-container">
        <div class="stat-row">
            <span class="stat-label">💪 Max:</span>
            <span class="flashy-number max-combo-glow">${stats.maxCombo}x combo</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">📝 Lines:</span>
            <span class="flashy-number lines-glow">${stats.totalLinesWritten.toLocaleString()}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">🐉 Bosses:</span>
            <span class="flashy-number bosses-glow">${stats.bossBattlesWon} defeated</span>
        </div>
    </div>
    
    <!-- Visual Combo Meter -->
    <div class="combo-container">
        <div class="combo-header">
            <span class="combo-title">${comboIcon} ${comboTitle}</span>
            <span class="combo-value ${comboClass}">${stats.combo}x</span>
        </div>
        <div class="combo-bar-container">
            <div class="combo-bar ${comboBarClass}" style="width: ${comboWidth}%"></div>
        </div>
        <div style="font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 4px;">
            Max: ${stats.maxCombo}x
        </div>
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
                    multiplier.textContent = message.multiplier;
                    
                    // Apply chaotic position and rotation with bouncing
                    if (message.position && message.rotation !== undefined) {
                        multiplier.style.left = message.position.x + '%';
                        multiplier.style.top = message.position.y + '%';
                        multiplier.style.transform = \`translate(-50%, -50%) scale(1) rotate(\${message.rotation}deg)\`;
                        
                        // Add chaotic movement over time
                        let bounceCount = 0;
                        const bounceInterval = setInterval(() => {
                            bounceCount++;
                            const bounce = Math.sin(bounceCount * 0.3) * 20;
                            const wobble = Math.cos(bounceCount * 0.2) * 15;
                            const newRotation = message.rotation + (Math.sin(bounceCount * 0.15) * 30);
                            multiplier.style.transform = \`translate(-50%, -50%) translate(\${wobble}px, \${bounce}px) scale(1) rotate(\${newRotation}deg)\`;
                            
                            if (bounceCount > 150) { // Stop after ~6 seconds
                                clearInterval(bounceInterval);
                            }
                        }, 40); // Update every 40ms for smooth chaos
                        
                    } else {
                        multiplier.style.transform = 'translate(-50%, -50%) scale(1)';
                    }
                    
                    // Add to container
                    container.appendChild(multiplier);
                    
                    // Add shake effect to knight image with proper cleanup
                    if (knightImage) {
                        knightImage.classList.add('shake');
                        const shakeTimer = setTimeout(() => {
                            knightImage.classList.remove('shake');
                        }, 1000); // 1000ms shake duration (increased from 500ms)
                        this.disposables.push(shakeTimer);
                    }
                    
                    // Remove this multiplier after 6 seconds with efficient cleanup (increased from 4 seconds)
                    const fadeTimer = setTimeout(() => {
                        if (multiplier.parentNode) {
                            multiplier.style.opacity = '0';
                            multiplier.style.transform = multiplier.style.transform + ' scale(0.3)';
                            const removeTimer = setTimeout(() => {
                                if (multiplier.parentNode) {
                                    container.removeChild(multiplier);
                                }
                            }, 500); // 500ms fade-out duration (increased from 300ms)
                            this.disposables.push(removeTimer);
                        }
                    }, 6000); // 6000ms total duration (increased from 4000ms)
                    this.disposables.push(fadeTimer);
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
