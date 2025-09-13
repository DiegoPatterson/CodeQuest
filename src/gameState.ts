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

export interface BossBattle {
    name: string;
    startTime: number;
    targetLines: number;
    currentLines: number;
    completed: boolean;
}

export class GameState {
    private context: vscode.ExtensionContext;
    private lastTypingTime: number = 0;
    private comboDecayTimer: NodeJS.Timeout | null = null;
    private refreshCallback: (() => void) | null = null;
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
        this.startComboDecaySystem();
    }

    setRefreshCallback(callback: () => void) {
        this.refreshCallback = callback;
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
        this.updateTypingTime(); // Track when user last typed
        this.stats.combo++;
        if (this.stats.combo > this.stats.maxCombo) {
            this.stats.maxCombo = this.stats.combo;
        }
        
        // Special combo milestone notifications
        if (this.stats.combo === 10) {
            vscode.window.showInformationMessage(`🔥 HOT STREAK! 10x combo achieved!`);
        } else if (this.stats.combo === 25) {
            vscode.window.showInformationMessage(`⚡ SUPER COMBO! 25x combo - You're on fire!`);
        } else if (this.stats.combo === 50) {
            vscode.window.showInformationMessage(`🌟 MEGA COMBO! 50x combo - UNSTOPPABLE!`);
        } else if (this.stats.combo === 100) {
            vscode.window.showInformationMessage(`💫 LEGENDARY COMBO! 100x combo - CODING MASTER!`);
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
            if (this.stats.currentBossBattle.currentLines >= this.stats.currentBossBattle.targetLines) {
                this.completeBossBattle();
            }
        }
        
        this.saveStats();
    }

    detectCopyPaste(lines: number) {
        this.addXP(Math.floor(lines * 0.5), '(summoned help)');
        vscode.window.showInformationMessage(`🧙‍♂️ You summoned help! +${Math.floor(lines * 0.5)} XP`);
        this.breakCombo();
    }

    startBossBattle(name: string) {
        const targetLines = Math.max(20, Math.floor(Math.random() * 100) + 20);
        this.stats.currentBossBattle = {
            name,
            startTime: Date.now(),
            targetLines,
            currentLines: 0,
            completed: false
        };
        this.saveStats();
    }

    completeBossBattle() {
        if (this.stats.currentBossBattle && !this.stats.currentBossBattle.completed) {
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