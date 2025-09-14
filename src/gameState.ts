import * as vscode from 'vscode';

export interface PlayerStats {
    level: number;
    xp: number;
    xpToNextLevel: number;
    dailyStreak: number;
    lastActiveDate: string;
    totalLinesWritten: number;
    combo: number;
    maxCombo: number;
    bossBattlesWon: number;
    currentBossBattle?: BossBattle;
}

export interface BossSubtask {
    id: string;
    description: string;
    completed: boolean;
}

export interface BossBattle {
    name: string;
    startTime: number;
    targetLines: number;
    currentLines: number;
    completed: boolean;
    subtasks: BossSubtask[];
}

export class GameState {
    private context: vscode.ExtensionContext;
    private lastTypingTime: number = 0;
    private comboDecayTimer: NodeJS.Timeout | null = null;
    private refreshCallback: (() => void) | null = null;
    private multiplierCallback: ((combo: number) => void) | null = null;
    private impactFrameCallback: (() => void) | null = null;
    private enabled: boolean = true; // Extension enabled state
    
    // Rate limiting for combo increments
    private lastComboIncrement: number = 0;
    private comboIncrementCooldown: number = 50; // Minimum 50ms between combo increments
    private recentIncrements: number[] = [];
    private readonly MAX_RECENT_INCREMENTS = 20; // Limit array size for memory
    
    // Wizard session tracking
    private wizardSessions: number = 0;
    private lastWizardActivity: number = 0;
    private wizardSessionActive: boolean = false;
    private readonly WIZARD_SESSION_TIMEOUT = 5000; // 5 seconds
    
    // Performance optimization: Cache stats object and only create new one when needed
    private _cachedStats: PlayerStats | null = null;
    private _statsDirty: boolean = true;
    
    // Disposables for proper cleanup
    private disposables: NodeJS.Timeout[] = [];
    
    private stats: PlayerStats = {
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        dailyStreak: 0,
        lastActiveDate: new Date().toDateString(),
        totalLinesWritten: 0,
        combo: 0,
        maxCombo: 0,
        bossBattlesWon: 0
    };

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadStats();
        this.loadEnabledState();
        this.startComboDecaySystem();
    }

    // Add proper cleanup method
    dispose() {
        // Clear all timers
        this.disposables.forEach(timer => clearTimeout(timer));
        this.disposables = [];
        
        if (this.comboDecayTimer) {
            clearInterval(this.comboDecayTimer);
            this.comboDecayTimer = null;
        }
        
        // Clear callbacks to prevent memory leaks
        this.refreshCallback = null;
        this.multiplierCallback = null;
        this.impactFrameCallback = null;
    }

    setRefreshCallback(callback: () => void) {
        this.refreshCallback = callback;
    }

    setMultiplierCallback(callback: (combo: number) => void) {
        this.multiplierCallback = callback;
    }

    setImpactFrameCallback(callback: () => void) {
        this.impactFrameCallback = callback;
    }

    // Extension enable/disable functionality
    isEnabled(): boolean {
        return this.enabled;
    }

    toggleEnabled(): boolean {
        this.enabled = !this.enabled;
        this.saveEnabledState();
        
        if (this.enabled) {
            vscode.window.showInformationMessage('🎮 CodeQuest RPG enabled! Time to level up!');
        } else {
            vscode.window.showInformationMessage('😴 CodeQuest RPG disabled. Coding in stealth mode.');
        }
        
        // Trigger UI refresh
        if (this.refreshCallback) {
            this.refreshCallback();
        }
        
        return this.enabled;
    }

    private loadEnabledState() {
        this.enabled = this.context.globalState.get('codequest.enabled', true);
    }

    private saveEnabledState() {
        this.context.globalState.update('codequest.enabled', this.enabled);
    }

    // Wizard session management
    recordWizardActivity() {
        const currentTime = Date.now();
        
        // If no recent wizard activity, start a new session
        if (!this.wizardSessionActive || (currentTime - this.lastWizardActivity) > this.WIZARD_SESSION_TIMEOUT) {
            this.wizardSessions++;
            this.wizardSessionActive = true;
            console.log('CodeQuest: New wizard session started. Total sessions:', this.wizardSessions);
        } else {
            console.log('CodeQuest: Extending existing wizard session');
        }
        
        this.lastWizardActivity = currentTime;
        console.log('CodeQuest: Wizard activity recorded. Active:', this.wizardSessionActive);
    }

    isWizardActive(): boolean {
        const currentTime = Date.now();
        
        // Check if wizard session has timed out
        if (this.wizardSessionActive && (currentTime - this.lastWizardActivity) > this.WIZARD_SESSION_TIMEOUT) {
            this.wizardSessionActive = false;
            // Only log on timeout, not every check for performance
        }
        
        return this.wizardSessionActive;
    }

    getWizardStats() {
        return {
            totalSessions: this.wizardSessions,
            currentlyActive: this.isWizardActive(),
            lastActivity: this.lastWizardActivity
        };
    }

    killWizardSession() {
        this.wizardSessionActive = false;
        this.lastWizardActivity = 0;
        console.log('CodeQuest: Wizard session manually terminated');
    }

    private startComboDecaySystem() {
        // Prevent multiple intervals
        if (this.comboDecayTimer) {
            clearInterval(this.comboDecayTimer);
        }
        
        // Start combo decay timer - combo decays faster now (every 3 seconds instead of longer)
        this.comboDecayTimer = setInterval(() => {
            const now = Date.now();
            // If user hasn't typed for 3 seconds, start reducing combo
            if (this.lastTypingTime > 0 && now - this.lastTypingTime > 3000) {
                if (this.stats.combo > 0) {
                    console.log(`CodeQuest: Combo decaying from ${this.stats.combo} to ${this.stats.combo - 1}`);
                    this.stats.combo = Math.max(0, this.stats.combo - 1);
                    this.markStatsDirty();
                    this.saveStats();
                    
                    // Trigger UI refresh when combo changes
                    if (this.refreshCallback) {
                        this.refreshCallback();
                    }
                }
            }
        }, 1000); // Check every second
    }

    getLastTypingTime(): number {
        return this.lastTypingTime;
    }

    updateTypingTime() {
        this.lastTypingTime = Date.now();
    }

    private loadStats() {
        const savedStats = this.context.globalState.get<PlayerStats>('codequest.stats');
        this.stats = savedStats || {
            level: 1,
            xp: 0,
            xpToNextLevel: 100,
            dailyStreak: 0,
            lastActiveDate: new Date().toDateString(),
            totalLinesWritten: 0,
            combo: 0,
            maxCombo: 0,
            bossBattlesWon: 0
        };
        this.markStatsDirty();
    }

    // Performance optimization: Mark stats as dirty and cache invalidation
    private markStatsDirty() {
        this._statsDirty = true;
        this._cachedStats = null;
    }

    private saveStats() {
        this.context.globalState.update('codequest.stats', this.stats);
        this.markStatsDirty(); // Invalidate cache when stats change
    }

    getStats(): PlayerStats {
        // Performance optimization: Return cached stats if available
        if (!this._statsDirty && this._cachedStats) {
            return this._cachedStats;
        }
        
        // Create a deep copy to prevent external modifications
        this._cachedStats = { ...this.stats };
        this._statsDirty = false;
        return this._cachedStats;
    }

    addXP(amount: number, reason: string = '') {
        if (!this.enabled) return; // Skip if extension is disabled
        
        this.stats.xp += amount;
        
        // Check for level up
        while (this.stats.xp >= this.stats.xpToNextLevel) {
            this.levelUp();
        }
        
        this.markStatsDirty();
        this.saveStats();
        
        if (amount > 0) {
            vscode.window.showInformationMessage(`⭐ +${amount} XP ${reason}`);
        }
    }

    private levelUp() {
        this.stats.xp -= this.stats.xpToNextLevel;
        this.stats.level++;
        this.stats.xpToNextLevel = Math.floor(this.stats.xpToNextLevel * 1.5);
        
        // Enhanced level up messages with achievements
        let message = `🎉 LEVEL UP! Welcome to Level ${this.stats.level}!`;
        let extraReward = '';
        
        if (this.stats.level === 10) {
            message = `⭐ EXPERT RANK ACHIEVED! Level ${this.stats.level} reached!`;
            extraReward = ' +50 Bonus XP!';
            this.stats.xp += 50;
        } else if (this.stats.level === 25) {
            message = `💎 MASTER RANK ACHIEVED! Level ${this.stats.level} reached!`;
            extraReward = ' +100 Bonus XP!';
            this.stats.xp += 100;
        } else if (this.stats.level === 50) {
            message = `👑 LEGENDARY STATUS! Level ${this.stats.level} - You are a coding legend!`;
            extraReward = ' +250 Bonus XP!';
            this.stats.xp += 250;
        }
        
        vscode.window.showInformationMessage(message + extraReward);
    }

    incrementCombo() {
        if (!this.enabled) return; // Skip if extension is disabled
        
        const now = Date.now();
        
        // Rate limiting: prevent combo spam from large text insertions
        if (now - this.lastComboIncrement < this.comboIncrementCooldown) {
            console.log('CodeQuest: Combo increment rate limited, skipping');
            return;
        }
        
        // Track recent increments to detect bulk operations
        this.recentIncrements.push(now);
        
        // Optimize: Keep only last MAX_RECENT_INCREMENTS for analysis
        if (this.recentIncrements.length > this.MAX_RECENT_INCREMENTS) {
            this.recentIncrements = this.recentIncrements.slice(-this.MAX_RECENT_INCREMENTS);
        }
        
        // If too many increments in short time, increase cooldown (likely large paste/AI)
        if (this.recentIncrements.length >= 10) {
            const timeSpan = now - this.recentIncrements[0];
            if (timeSpan < 2000) { // 10+ increments in 2 seconds
                this.comboIncrementCooldown = 200; // Increase cooldown significantly
                console.log('CodeQuest: Bulk operation detected, increasing combo cooldown');
            } else {
                this.comboIncrementCooldown = 50; // Normal cooldown
            }
        }
        
        this.lastComboIncrement = now;
        
        this.updateTypingTime(); // Track when user last typed
        this.stats.combo++;
        if (this.stats.combo > this.stats.maxCombo) {
            this.stats.maxCombo = this.stats.combo;
        }
        
        // Trigger impact frame on every typing event (rate limited in sidebarProvider)
        if (this.impactFrameCallback) {
            this.impactFrameCallback();
        }
        
        // Trigger multiplier display
        if (this.multiplierCallback && this.stats.combo >= 5) {
            this.multiplierCallback(this.stats.combo);
        }
        
        // Special combo milestone notifications - batch these to reduce overhead
        this.handleComboMilestones();
        
        // Combo bonuses - more frequent and varied
        if (this.stats.combo % 5 === 0 && this.stats.combo >= 5) {
            const bonusXP = this.stats.combo;
            this.addXP(bonusXP, `(${this.stats.combo}x combo bonus!)`);
        }
        
        this.markStatsDirty();
        this.saveStats();
    }

    // Optimize combo milestone handling
    private handleComboMilestones() {
        const combo = this.stats.combo;
        let message = '';
        
        if (combo === 10) {
            message = `🔥 HOT STREAK! 10x combo achieved!`;
        } else if (combo === 25) {
            message = `⚡ SUPER COMBO! 25x combo - You're on fire!`;
        } else if (combo === 50) {
            message = `🌟 MEGA COMBO! 50x combo - UNSTOPPABLE!`;
        } else if (combo === 100) {
            message = `💫 LEGENDARY COMBO! 100x combo - CODING MASTER!`;
        }
        
        if (message) {
            vscode.window.showInformationMessage(message);
        }
    }

    breakCombo() {
        if (this.stats.combo > 5) {
            vscode.window.showWarningMessage(`💥 Combo broken at ${this.stats.combo}x!`);
        }
        this.stats.combo = 0;
        this.markStatsDirty();
        this.saveStats();
    }

    addLinesWritten(lines: number) {
        if (!this.enabled) return; // Skip if extension is disabled
        
        this.stats.totalLinesWritten += lines;
        this.addXP(lines * 2, `(${lines} lines written)`);
        this.incrementCombo();
        this.updateDailyActivity();
        
        // Update boss battle progress
        if (this.stats.currentBossBattle && !this.stats.currentBossBattle.completed) {
            this.stats.currentBossBattle.currentLines += lines;
            // Note: Boss battle completion is now manual only - no auto-completion
        }
        
        this.markStatsDirty();
        this.saveStats();
    }

    detectCopyPaste(lines: number) {
        if (!this.enabled) return; // Skip if extension is disabled
        
        this.addXP(Math.floor(lines * 0.5), '(summoned help)');
        vscode.window.showInformationMessage(`🧙‍♂️ You summoned help! +${Math.floor(lines * 0.5)} XP`);
        this.breakCombo();
    }

    startBossBattle(name: string, subtaskDescriptions: string[] = []) {
        const targetLines = Math.max(20, Math.floor(Math.random() * 100) + 20);
        
        // Convert subtask descriptions to BossSubtask objects
        const subtasks: BossSubtask[] = subtaskDescriptions.map((desc, index) => ({
            id: `subtask_${index}`,
            description: desc,
            completed: false
        }));
        
        this.stats.currentBossBattle = {
            name,
            startTime: Date.now(),
            targetLines,
            currentLines: 0,
            completed: false,
            subtasks
        };
        console.log('GameState: Boss battle started!');
        console.log('GameState: Boss battle details:', this.stats.currentBossBattle);
        this.markStatsDirty();
        this.saveStats();
    }

    toggleSubtask(subtaskId: string) {
        if (this.stats.currentBossBattle && !this.stats.currentBossBattle.completed) {
            const subtask = this.stats.currentBossBattle.subtasks.find(st => st.id === subtaskId);
            if (subtask) {
                subtask.completed = !subtask.completed;
                console.log(`GameState: Toggled subtask "${subtask.description}" to ${subtask.completed ? 'completed' : 'incomplete'}`);
                this.markStatsDirty();
                this.saveStats();
            }
        }
    }

    canCompleteBossBattle(): boolean {
        if (!this.stats.currentBossBattle || this.stats.currentBossBattle.completed) {
            return false;
        }
        
        // All subtasks must be completed
        return this.stats.currentBossBattle.subtasks.every(subtask => subtask.completed);
    }

    completeBossBattle() {
        if (this.stats.currentBossBattle && !this.stats.currentBossBattle.completed) {
            // Check if all subtasks are completed
            if (!this.canCompleteBossBattle()) {
                // More efficient: single pass through subtasks
                const incompleteSubtasks: string[] = [];
                for (const subtask of this.stats.currentBossBattle.subtasks) {
                    if (!subtask.completed) {
                        incompleteSubtasks.push(subtask.description);
                    }
                }
                vscode.window.showWarningMessage(`❌ Cannot complete boss battle! Please finish these subtasks first: ${incompleteSubtasks.join(', ')}`);
                return;
            }
            
            const battle = this.stats.currentBossBattle;
            battle.completed = true;
            
            const timeBonus = Math.max(0, 1000 - Math.floor((Date.now() - battle.startTime) / 60000) * 10);
            const xpReward = 100 + timeBonus;
            
            this.stats.bossBattlesWon++;
            this.addXP(xpReward, `(Boss Battle: ${battle.name})`);
            
            vscode.window.showInformationMessage(`⚔️ Boss Battle Complete! Defeated: ${battle.name}`);
            
            this.stats.currentBossBattle = undefined;
            this.markStatsDirty();
            this.saveStats();
        }
    }

    killBossBattle() {
        if (this.stats.currentBossBattle) {
            const battleName = this.stats.currentBossBattle.name;
            this.stats.currentBossBattle = undefined;
            this.markStatsDirty();
            this.saveStats();
            vscode.window.showInformationMessage(`🚫 Boss Battle Cancelled: ${battleName}`);
        } else {
            vscode.window.showInformationMessage(`No active boss battle to cancel.`);
        }
    }

    private updateDailyActivity() {
        const today = new Date().toDateString();
        if (this.stats.lastActiveDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (this.stats.lastActiveDate === yesterday.toDateString()) {
                this.stats.dailyStreak++;
            } else {
                this.stats.dailyStreak = 1;
            }
            
            this.stats.lastActiveDate = today;
            vscode.window.showInformationMessage(`🔥 Daily streak: ${this.stats.dailyStreak} days!`);
        }
    }

    checkDailyStreak() {
        const today = new Date().toDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (this.stats.lastActiveDate !== today && this.stats.lastActiveDate !== yesterday.toDateString()) {
            if (this.stats.dailyStreak > 0) {
                vscode.window.showWarningMessage(`💔 Daily streak lost! (${this.stats.dailyStreak} days)`);
                this.stats.dailyStreak = 0;
                this.markStatsDirty();
                this.saveStats();
            }
        }
    }

    resetStats() {
        this.stats = {
            level: 1,
            xp: 0,
            xpToNextLevel: 100,
            dailyStreak: 0,
            lastActiveDate: new Date().toDateString(),
            totalLinesWritten: 0,
            combo: 0,
            maxCombo: 0,
            bossBattlesWon: 0
        };
        this.markStatsDirty();
        this.saveStats();
    }
}