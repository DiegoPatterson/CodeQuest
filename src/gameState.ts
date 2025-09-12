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
        
        vscode.window.showInformationMessage(`🎉 Level Up! You're now level ${this.stats.level}!`);
    }

    incrementCombo() {
        this.stats.combo++;
        if (this.stats.combo > this.stats.maxCombo) {
            this.stats.maxCombo = this.stats.combo;
        }
        
        // Combo bonuses
        if (this.stats.combo % 10 === 0) {
            this.addXP(this.stats.combo, `(${this.stats.combo}x combo bonus!)`);
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