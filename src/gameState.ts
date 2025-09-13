import * as vscode from 'vscode';
import { SoundManager } from './soundManager';

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
    private soundManager?: SoundManager;
    private lastTypingTime: number = 0;
    private comboDecayTimer: NodeJS.Timeout | null = null;
    private refreshCallback: (() => void) | null = null;
    private multiplierCallback: ((combo: number) => void) | null = null;
    private impactFrameCallback: (() => void) | null = null;
    
    // Rate limiting for combo increments
    private lastComboIncrement: number = 0;
    private comboIncrementCooldown: number = 50; // Minimum 50ms between combo increments
    private recentIncrements: number[] = [];
    
    // Wizard session tracking
    private wizardSessions: number = 0;
    private lastWizardActivity: number = 0;
    private wizardSessionActive: boolean = false;
    private readonly WIZARD_SESSION_TIMEOUT = 5000; // 5 seconds
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

    constructor(context: vscode.ExtensionContext, soundManager?: SoundManager) {
        this.context = context;
        this.soundManager = soundManager;
        this.loadStats();
        this.startComboDecaySystem();
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

    // Wizard session management
    recordWizardActivity() {
        const currentTime = Date.now();
        
        // If no recent wizard activity, start a new session
        if (!this.wizardSessionActive || (currentTime - this.lastWizardActivity) > this.WIZARD_SESSION_TIMEOUT) {
            this.wizardSessions++;
            this.wizardSessionActive = true;
            console.log('CodeQuest: New wizard session started. Total sessions:', this.wizardSessions);
            
            // Play wizard appear sound for new sessions
            if (this.soundManager) {
                this.soundManager.playWizardAppear();
            }
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
            console.log('CodeQuest: Wizard session timed out');
        }
        
        console.log('CodeQuest: isWizardActive check - Active:', this.wizardSessionActive, 'Time since last activity:', currentTime - this.lastWizardActivity);
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
        // Start combo decay timer - combo decays faster now (every 3 seconds instead of longer)
        setInterval(() => {
            const now = Date.now();
            // If user hasn't typed for 3 seconds, start reducing combo
            if (this.lastTypingTime > 0 && now - this.lastTypingTime > 3000) {
                if (this.stats.combo > 0) {
                    console.log(`CodeQuest: Combo decaying from ${this.stats.combo} to ${this.stats.combo - 1}`);
                    this.stats.combo = Math.max(0, this.stats.combo - 1);
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
    }

    private saveStats() {
        this.context.globalState.update('codequest.stats', this.stats);
    }

    getStats(): PlayerStats {
        return { ...this.stats };
    }

    addXP(amount: number, reason: string = '') {
        this.stats.xp += amount;
        
        // Check for level up
        while (this.stats.xp >= this.stats.xpToNextLevel) {
            this.levelUp();
        }
        
        this.saveStats();
        
        if (amount > 0) {
            vscode.window.showInformationMessage(`⭐ +${amount} XP ${reason}`);
        }
    }

    private levelUp() {
        this.stats.xp -= this.stats.xpToNextLevel;
        this.stats.level++;
        this.stats.xpToNextLevel = Math.floor(this.stats.xpToNextLevel * 1.5);
        
        // Play level up sound
        if (this.soundManager) {
            this.soundManager.playLevelUp();
        }
        
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
        const now = Date.now();
        
        // Rate limiting: prevent combo spam from large text insertions
        if (now - this.lastComboIncrement < this.comboIncrementCooldown) {
            console.log('CodeQuest: Combo increment rate limited, skipping');
            return;
        }
        
        // Track recent increments to detect bulk operations
        this.recentIncrements.push(now);
        
        // Keep only last 20 increments for analysis
        if (this.recentIncrements.length > 20) {
            this.recentIncrements = this.recentIncrements.slice(-20);
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
        
        // Special combo milestone notifications
        if (this.stats.combo === 10) {
            vscode.window.showInformationMessage(`🔥 HOT STREAK! 10x combo achieved!`);
            if (this.soundManager) {
                this.soundManager.playComboMilestone();
            }
        } else if (this.stats.combo === 25) {
            vscode.window.showInformationMessage(`⚡ SUPER COMBO! 25x combo - You're on fire!`);
            if (this.soundManager) {
                this.soundManager.playComboMilestone();
            }
        } else if (this.stats.combo === 50) {
            vscode.window.showInformationMessage(`🌟 MEGA COMBO! 50x combo - UNSTOPPABLE!`);
            if (this.soundManager) {
                this.soundManager.playComboMilestone();
            }
        } else if (this.stats.combo === 100) {
            vscode.window.showInformationMessage(`💫 LEGENDARY COMBO! 100x combo - CODING MASTER!`);
            if (this.soundManager) {
                this.soundManager.playComboMilestone();
            }
        }
        
        // Combo bonuses - more frequent and varied
        if (this.stats.combo % 5 === 0 && this.stats.combo >= 5) {
            const bonusXP = this.stats.combo;
            this.addXP(bonusXP, `(${this.stats.combo}x combo bonus!)`);
        }
        
        this.saveStats();
    }

    breakCombo() {
        if (this.stats.combo > 5) {
            vscode.window.showWarningMessage(`💥 Combo broken at ${this.stats.combo}x!`);
        }
        this.stats.combo = 0;
        this.saveStats();
    }

    addLinesWritten(lines: number) {
        this.stats.totalLinesWritten += lines;
        this.addXP(lines * 2, `(${lines} lines written)`);
        this.incrementCombo();
        this.updateDailyActivity();
        
        // Update boss battle progress
        if (this.stats.currentBossBattle && !this.stats.currentBossBattle.completed) {
            this.stats.currentBossBattle.currentLines += lines;
            // Note: Boss battle completion is now manual only - no auto-completion
        }
        
        this.saveStats();
    }

    detectCopyPaste(lines: number) {
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
        this.saveStats();
    }

    toggleSubtask(subtaskId: string) {
        if (this.stats.currentBossBattle && !this.stats.currentBossBattle.completed) {
            const subtask = this.stats.currentBossBattle.subtasks.find(st => st.id === subtaskId);
            if (subtask) {
                subtask.completed = !subtask.completed;
                console.log(`GameState: Toggled subtask "${subtask.description}" to ${subtask.completed ? 'completed' : 'incomplete'}`);
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
                const incompleteSubtasks = this.stats.currentBossBattle.subtasks
                    .filter(st => !st.completed)
                    .map(st => st.description)
                    .join(', ');
                vscode.window.showWarningMessage(`❌ Cannot complete boss battle! Please finish these subtasks first: ${incompleteSubtasks}`);
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
            this.saveStats();
        }
    }

    killBossBattle() {
        if (this.stats.currentBossBattle) {
            const battleName = this.stats.currentBossBattle.name;
            this.stats.currentBossBattle = undefined;
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
        this.saveStats();
    }
}