import * as vscode from 'vscode';
import { GameState, PlayerStats } from './gameState';

export interface VisualState {
    playerState: 'idle' | 'fighting' | 'boss_battle';
    currentEnemy?: Enemy;
    wizardPresent: boolean;
    bossCheckpoints: BossCheckpoint[];
    useImages?: boolean; // New flag for image display
}

export interface Enemy {
    name: string;
    type: 'slime' | 'dragon' | 'goblin';
    maxHealth: number;
    currentHealth: number;
    ascii: string[];
}

export interface BossCheckpoint {
    id: string;
    description: string;
    completed: boolean;
    targetLines: number;
    currentLines: number;
}

export class VisualEngine {
    private visualState: VisualState;
    private currentSlime?: Enemy;
    private lastActivity: number = Date.now();
    private readonly IDLE_DELAY = 30000; // 30 seconds delay before going idle
    private animationFrame: number = 0;
    private lastAnimationTime: number = Date.now();

    constructor(private gameState: GameState) {
        this.visualState = {
            playerState: 'idle',
            wizardPresent: false,
            bossCheckpoints: [],
            useImages: false
        };
        this.spawnNewSlime();
    }

    // Check if we should display images instead of ASCII
    shouldUseImages(): boolean {
        const now = Date.now();
        const lastTypingTime = this.gameState.getLastTypingTime();
        const stats = this.gameState.getStats();
        
        const timeSinceLastTyping = lastTypingTime > 0 ? now - lastTypingTime : 999999;
        const shouldShowIdle = timeSinceLastTyping > this.IDLE_DELAY && stats.combo === 0;
        
        this.visualState.useImages = shouldShowIdle;
        this.visualState.playerState = shouldShowIdle ? 'idle' : 'fighting';
        
        return shouldShowIdle;
    }

    getVisualState(): VisualState {
        // Ensure state is up to date by refreshing it
        this.refreshVisualState();
        const state = { ...this.visualState };
        console.log('VisualEngine: getVisualState called, returning:', state);
        return state;
    }

    public refreshVisualState(): void {
        const stats = this.gameState.getStats();
        const lastTypingTime = this.gameState.getLastTypingTime();
        const now = Date.now();
        
        // Check if we should go idle (30 second delay AND combo is 0)
        const timeSinceLastTyping = lastTypingTime > 0 ? now - lastTypingTime : 999999;
        const shouldShowIdle = timeSinceLastTyping > this.IDLE_DELAY && stats.combo === 0;
        
        // Check wizard presence
        const wizardActive = this.gameState.isWizardActive();
        
        // Update visual state for webview
        if (stats.currentBossBattle) {
            console.log('VisualEngine: Boss battle detected!', stats.currentBossBattle);
            this.visualState.playerState = 'boss_battle';
            this.visualState.useImages = true; // Boss battles should show dragon images
            
            // Auto-generate boss checkpoints if none exist
            if (this.visualState.bossCheckpoints.length === 0) {
                this.generateBossCheckpoints(stats.currentBossBattle);
            }
        } else if (shouldShowIdle) {
            this.visualState.playerState = 'idle';
            this.visualState.useImages = true;
            // Clear boss checkpoints when not in boss battle
            this.visualState.bossCheckpoints = [];
        } else {
            this.visualState.playerState = 'fighting';
            this.visualState.useImages = false; // Fighting will show images in webview regardless
            // Clear boss checkpoints when not in boss battle
            this.visualState.bossCheckpoints = [];
        }
        
        // Update wizard presence
        this.visualState.wizardPresent = wizardActive;
        
        console.log(`CodeQuest Visual: state=${this.visualState.playerState}, useImages=${this.visualState.useImages}, wizard=${wizardActive}`);
    }

    updateVisual(wordsTyped: number, hasAI: boolean = false): string[] {
        const now = Date.now();
        const lastTypingTime = this.gameState.getLastTypingTime();
        
        // Update activity if user is actively typing
        if (wordsTyped > 0) {
            this.lastActivity = now;
        }
        
        this.visualState.wizardPresent = hasAI;

        const stats = this.gameState.getStats();
        
        // Check if we should go idle (30 second delay AND combo is 0)
        const timeSinceLastTyping = lastTypingTime > 0 ? now - lastTypingTime : 999999;
        const shouldShowIdle = timeSinceLastTyping > this.IDLE_DELAY && stats.combo === 0;
        
        // Update visual state for webview
        if (stats.currentBossBattle) {
            console.log('VisualEngine: Boss battle detected!', stats.currentBossBattle);
            this.visualState.playerState = 'boss_battle';
            this.visualState.useImages = true; // Boss battles should show dragon images
        } else if (shouldShowIdle) {
            this.visualState.playerState = 'idle';
            this.visualState.useImages = true;
        } else {
            this.visualState.playerState = 'fighting';
            this.visualState.useImages = false; // Fighting will show images in webview regardless
        }
        
        console.log(`CodeQuest Visual: lastTyping=${lastTypingTime}, timeSince=${timeSinceLastTyping}, combo=${stats.combo}, state=${this.visualState.playerState}`);
        
        // Return ASCII for TreeProvider (this is still used for TreeProvider display)
        if (stats.currentBossBattle) {
            return this.renderBossBattle(stats);
        } else if (!shouldShowIdle) {
            return this.renderSlimeFight(wordsTyped, stats);
        } else {
            return this.renderAnimatedIdle(stats);
        }
    }

    private renderAnimatedIdle(stats: PlayerStats): string[] {
        const visual = [];
        
        // Update animation frame every 2 seconds
        const now = Date.now();
        if (now - this.lastAnimationTime > 2000) {
            this.animationFrame = (this.animationFrame + 1) % 2;
            this.lastAnimationTime = now;
        }
        
        visual.push("🏰 ═══ KNIGHT'S CAMP ═══ 🏰");
        visual.push("");
        visual.push("        🌟✨🌟         ");
        
        // Animated campfire (flickers)
        const fireFrame = Math.floor(now / 500) % 2;
        if (fireFrame === 0) {
            visual.push("         🔥🔥🔥         ");
            visual.push("      🪵🔥🔥🔥🪵      ");
        } else {
            visual.push("         🔥🔥🔥         ");
            visual.push("      🪵🔥🔥🔥🪵      ");
        }
        
        // Animated knight (alternates between two poses)
        if (this.animationFrame === 0) {
            // Knight sitting normally
            visual.push("         ⚔️👑         ");
            visual.push("        /🛡️ 🛡️\\        ");
            visual.push("       👢     👢       ");
        } else {
            // Knight shifting slightly (different pose)
            visual.push("         👑⚔️         ");
            visual.push("        \\🛡️ 🛡️/        ");
            visual.push("       👢     👢       ");
        }
        
        visual.push("");
        visual.push("🍖 Resting at camp... 🍖");
        visual.push("💤 Ready for adventure! 💤");
        
        if (this.visualState.wizardPresent) {
            visual.push("");
            visual.push("🧙‍♂️ Wizard nearby! 🪄✨");
        }
        
        return visual;
    }

    private renderIdle(stats: PlayerStats): string[] {
        const visual = [];
        
        // Campfire scene
        visual.push("🏰 ═══ KNIGHT'S CAMP ═══ 🏰");
        visual.push("");
        visual.push("        🌟✨🌟         ");
        visual.push("         🔥🔥🔥         ");
        visual.push("      🪵🔥🔥🔥🪵      ");
        visual.push("         ⚔️👑⚔️         ");
        visual.push("        /🛡️ 🛡️\\        ");
        visual.push("       👢     👢       ");
        visual.push("");
        visual.push("🍖 Resting at camp... 🍖");
        visual.push("💤 Ready for adventure! 💤");
        
        if (this.visualState.wizardPresent) {
            visual.push("");
            visual.push("🧙‍♂️ Wizard nearby! 🪄✨");
        }
        
        return visual;
    }

    private renderSlimeFight(wordsTyped: number, stats: PlayerStats): string[] {
        const visual = [];
        
        // Damage slime based on combo
        if (this.currentSlime && stats.combo > 0) {
            const damage = Math.min(wordsTyped * 2, this.currentSlime.currentHealth);
            this.currentSlime.currentHealth -= damage;
            
            if (this.currentSlime.currentHealth <= 0) {
                this.spawnNewSlime();
            }
        }

        visual.push("⚔️ ═══ COMBAT MODE ═══ ⚔️");
        visual.push("");
        
        // Knight attacking
        visual.push("       ⚡💥⚡💥⚡       ");
        visual.push("         ⚔️👑         ");
        visual.push("        /🛡️ 🛡️\\        ");
        visual.push("       👢  ⚡  👢       ");
        visual.push("");
        
        // Enemy
        if (this.currentSlime) {
            const healthBar = this.createHealthBar(this.currentSlime.currentHealth, this.currentSlime.maxHealth);
            visual.push(`🟢 ${this.currentSlime.name} ${healthBar}`);
            visual.push("");
            visual.push("     💚🟢💚🟢💚     ");
            visual.push("    🟢(◕  ◕)🟢    ");
            visual.push("   💚🟢🟢🟢🟢💚   ");
            visual.push("     ~~~💧~~~     ");
        }
        
        visual.push("");
        visual.push(`🔥 Combo: ${stats.combo}x DAMAGE! 🔥`);
        
        if (this.visualState.wizardPresent) {
            visual.push("");
            visual.push("🧙‍♂️ Wizard casts AI magic! 🪄✨");
            visual.push("💫 Double XP bonus! 💫");
        }
        
        return visual;
    }

    private renderBossBattle(stats: PlayerStats): string[] {
        const visual = [];
        const boss = stats.currentBossBattle!;
        
        visual.push("🐉 ═══ BOSS BATTLE ═══ 🐉");
        visual.push("");
        visual.push(`⚔️ ${boss.name.toUpperCase()} ⚔️`);
        visual.push("");
        
        // Epic boss battle scene
        visual.push("    🔥🔥🔥 👑 🔥🔥🔥    ");
        visual.push("     ⚔️⚡🛡️⚡⚔️     ");
        visual.push("    /🛡️  ⚔️  🛡️\\    ");
        visual.push("   👢 💥⚡💥⚡💥 👢   ");
        visual.push("");
        visual.push("  VS  🐲🔥🔥🔥🔥🐲  ");
        visual.push("      🔥👁️ 👁️🔥      ");
        visual.push("     🔥🔥🔥🔥🔥🔥     ");
        visual.push("    🦎🦎🦎🦎🦎🦎    ");
        
        // Boss health bar
        const bossHealthPercentage = (boss.currentLines / boss.targetLines) * 100;
        const bossHealthBar = this.createHealthBar(boss.targetLines - boss.currentLines, boss.targetLines);
        visual.push("");
        visual.push(`🐉 Dragon Health: ${bossHealthBar} (${Math.max(0, boss.targetLines - boss.currentLines)} HP)`);
        
        // Progress bar
        const progressBar = this.createProgressBar(boss.currentLines, boss.targetLines);
        visual.push(`📊 Progress: ${progressBar} ${boss.currentLines}/${boss.targetLines}`);
        
        // Checkpoints
        if (this.visualState.bossCheckpoints.length > 0) {
            visual.push("");
            visual.push("🎯 BATTLE OBJECTIVES:");
            this.visualState.bossCheckpoints.forEach(checkpoint => {
                const status = checkpoint.completed ? "✅" : "⏳";
                visual.push(`${status} ${checkpoint.description}`);
            });
        }
        
        if (this.visualState.wizardPresent) {
            visual.push("");
            visual.push("🧙‍♂️ Wizard aids in battle! 🪄⚡");
            visual.push("🌟 LEGENDARY POWER! 🌟");
        }
        
        return visual;
    }

    private spawnNewSlime(): void {
        const slimeTypes = [
            { name: "Green Slime", health: 15 },
            { name: "Blue Slime", health: 20 },
            { name: "Fire Slime", health: 25 },
            { name: "King Slime", health: 40 }
        ];
        
        const randomSlime = slimeTypes[Math.floor(Math.random() * slimeTypes.length)];
        this.currentSlime = {
            name: randomSlime.name,
            type: 'slime',
            maxHealth: randomSlime.health,
            currentHealth: randomSlime.health,
            ascii: []
        };
    }

    setBossCheckpoints(checkpoints: BossCheckpoint[]): void {
        this.visualState.bossCheckpoints = checkpoints;
    }

    private generateBossCheckpoints(bossBattle: any): void {
        const checkpoints: BossCheckpoint[] = [];
        const totalLines = bossBattle.targetLines;
        const segments = Math.min(4, Math.max(2, Math.floor(totalLines / 25))); // 2-4 checkpoints based on size
        
        for (let i = 1; i <= segments; i++) {
            const targetLines = Math.floor((totalLines * i) / segments);
            checkpoints.push({
                id: `checkpoint-${i}`,
                description: `Phase ${i}`,
                targetLines: targetLines,
                currentLines: Math.min(bossBattle.currentLines, targetLines),
                completed: bossBattle.currentLines >= targetLines
            });
        }
        
        this.visualState.bossCheckpoints = checkpoints;
    }

    updateBossCheckpoint(checkpointId: string, completed: boolean): void {
        const checkpoint = this.visualState.bossCheckpoints.find(c => c.id === checkpointId);
        if (checkpoint) {
            checkpoint.completed = completed;
        }
    }

    private createHealthBar(current: number, max: number, length: number = 10): string {
        const percentage = Math.max(0, current / max);
        const filled = Math.floor(percentage * length);
        const empty = length - filled;
        return '█'.repeat(filled) + '▒'.repeat(empty) + ` ${current}/${max}`;
    }

    private createProgressBar(current: number, max: number, length: number = 10): string {
        const percentage = Math.min(1, current / max);
        const filled = Math.floor(percentage * length);
        const empty = length - filled;
        return '█'.repeat(filled) + '▒'.repeat(empty);
    }

    detectAI(text: string): boolean {
        // Simple AI detection patterns
        const aiPatterns = [
            /\/\/ generated by/i,
            /\/\* auto-generated/i,
            /copilot/i,
            /chatgpt/i,
            /ai generated/i,
            /automatically generated/i
        ];
        
        return aiPatterns.some(pattern => pattern.test(text));
    }
    
    // Add proper cleanup method to prevent memory leaks
    dispose() {
        // Clear all references to prevent circular dependencies
        this.visualState.bossCheckpoints = [];
        this.currentSlime = undefined;
        // Don't clear gameState reference as it may be shared
    }
}