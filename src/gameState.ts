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

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    type: 'temporary' | 'permanent';
    timestamp: number;
    category?: 'level' | 'combo' | 'boss' | 'streak' | 'milestone';
    data?: any; // Additional context data
}

export interface AchievementStorage {
    temporaryAchievements: Achievement[];
    permanentAchievements: Achievement[];
    lastCleanup: number;
}

export class GameState {
    private context: vscode.ExtensionContext;
    private lastTypingTime: number = 0;
    private comboDecayTimer: NodeJS.Timeout | null = null;
    private refreshCallback: (() => void) | null = null;
    private multiplierCallback: ((combo: number) => void) | null = null;
    private impactFrameCallback: (() => void) | null = null;
    private enabled: boolean = true; // Extension enabled state
    
    // Rate limiting for combo increments - Memory optimized with circular buffer
    private lastComboIncrement: number = 0;
    private comboIncrementCooldown: number = 50; // Minimum 50ms between combo increments
    
    // Memory-efficient circular buffer for recent increments
    private recentIncrements: Float64Array;
    private recentIncrementsIndex: number = 0;
    private readonly MAX_RECENT_INCREMENTS = 20;
    
    // Wizard session tracking
    private wizardSessions: number = 0;
    private lastWizardActivity: number = 0;
    private wizardSessionActive: boolean = false;
    private readonly WIZARD_SESSION_TIMEOUT = 5000; // 5 seconds
    
    // Performance optimization: Object pooling for stats
    private _cachedStats: PlayerStats | null = null;
    private _statsDirty: boolean = true;
    private static _statsPool: PlayerStats[] = []; // Static pool for reuse
    
    // Memory-efficient disposables management
    private disposables: Set<NodeJS.Timeout> = new Set();
    
    // Memory optimization: Reduce object allocations
    private _tempDate: Date = new Date(); // Reuse date object
    
    // Achievement system storage
    private achievements: AchievementStorage = {
        temporaryAchievements: [],
        permanentAchievements: [],
        lastCleanup: Date.now()
    };
    
    // Achievement constants
    private readonly MAX_TEMPORARY_ACHIEVEMENTS = 10;
    private readonly TEMPORARY_ACHIEVEMENT_LIFETIME = 30000; // 30 seconds
    private readonly CLEANUP_INTERVAL = 60000; // Clean up every minute
    
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
        
        // Initialize memory-efficient data structures
        this.recentIncrements = new Float64Array(this.MAX_RECENT_INCREMENTS);
        this.disposables = new Set();
        
        this.loadStats();
        this.loadEnabledState();
        this.loadAchievements();
        this.startComboDecaySystem();
    }

    // Add proper cleanup method
    dispose() {
        // Clear all timers efficiently
        this.disposables.forEach(timer => clearTimeout(timer));
        this.disposables.clear();
        
        if (this.comboDecayTimer) {
            clearInterval(this.comboDecayTimer);
            this.comboDecayTimer = null;
        }
        
        // Clear callbacks to prevent memory leaks
        this.refreshCallback = null;
        this.multiplierCallback = null;
        this.impactFrameCallback = null;
        
        // Return cached stats to pool
        this.returnStatsToPool();
    }

    // Memory optimization: Object pooling for stats
    private returnStatsToPool() {
        if (this._cachedStats && GameState._statsPool.length < 5) {
            // Reset stats object for reuse
            Object.assign(this._cachedStats, {
                level: 1, xp: 0, xpToNextLevel: 100, dailyStreak: 0,
                lastActiveDate: '', totalLinesWritten: 0, combo: 0,
                maxCombo: 0, bossBattlesWon: 0, currentBossBattle: undefined
            });
            GameState._statsPool.push(this._cachedStats);
        }
        this._cachedStats = null;
    }

    private getPooledStats(): PlayerStats {
        return GameState._statsPool.pop() || {
            level: 1, xp: 0, xpToNextLevel: 100, dailyStreak: 0,
            lastActiveDate: '', totalLinesWritten: 0, combo: 0,
            maxCombo: 0, bossBattlesWon: 0
        };
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

    // ==================== ACHIEVEMENT SYSTEM ====================
    
    /**
     * Add a new achievement to the system
     */
    addAchievement(achievement: Omit<Achievement, 'timestamp'>): void {
        const fullAchievement: Achievement = {
            ...achievement,
            timestamp: Date.now()
        };

        if (achievement.type === 'temporary') {
            // Add to temporary achievements
            this.achievements.temporaryAchievements.push(fullAchievement);
            
            // Ensure we don't exceed max temporary achievements
            while (this.achievements.temporaryAchievements.length > this.MAX_TEMPORARY_ACHIEVEMENTS) {
                this.achievements.temporaryAchievements.shift(); // Remove oldest
            }
        } else {
            // Check if permanent achievement already exists
            const exists = this.achievements.permanentAchievements.some(a => a.id === achievement.id);
            if (!exists) {
                this.achievements.permanentAchievements.push(fullAchievement);
            }
        }

        this.saveAchievements();
        
        // Trigger UI refresh
        if (this.refreshCallback) {
            this.refreshCallback();
        }
    }

    /**
     * Get all achievements (temporary and permanent)
     */
    getAchievements(): AchievementStorage {
        this.cleanupExpiredAchievements();
        return {
            temporaryAchievements: [...this.achievements.temporaryAchievements],
            permanentAchievements: [...this.achievements.permanentAchievements],
            lastCleanup: this.achievements.lastCleanup
        };
    }

    /**
     * Get achievements for display (limited and sorted)
     */
    getAchievementsForDisplay(): { temporary: Achievement[], permanent: Achievement[] } {
        this.cleanupExpiredAchievements();
        
        // Get the most recent temporary achievements (max 10)
        const temporary = this.achievements.temporaryAchievements
            .slice(-this.MAX_TEMPORARY_ACHIEVEMENTS)
            .reverse(); // Show newest first

        // Get the most recent permanent achievements (max 20)
        const permanent = this.achievements.permanentAchievements
            .slice(-20)
            .reverse(); // Show newest first

        return { temporary, permanent };
    }

    /**
     * Clean up expired temporary achievements
     */
    private cleanupExpiredAchievements(): void {
        const now = Date.now();
        
        // Only clean up if enough time has passed
        if (now - this.achievements.lastCleanup < this.CLEANUP_INTERVAL) {
            return;
        }

        const before = this.achievements.temporaryAchievements.length;
        this.achievements.temporaryAchievements = this.achievements.temporaryAchievements
            .filter(achievement => now - achievement.timestamp < this.TEMPORARY_ACHIEVEMENT_LIFETIME);
        
        this.achievements.lastCleanup = now;
        
        // Only save if we removed achievements
        if (before !== this.achievements.temporaryAchievements.length) {
            this.saveAchievements();
        }
    }

    /**
     * Helper methods for common achievement types
     */
    addLevelUpAchievement(level: number): void {
        let title = `Level ${level}!`;
        let icon = '🎉';
        let category: Achievement['category'] = 'level';

        // Special level milestones get permanent achievements
        if (level === 10) {
            icon = '⭐';
            title = 'Expert Rank Achieved!';
            this.addAchievement({
                id: `level_expert_${level}`,
                title,
                description: `Reached level ${level} - You're becoming a coding expert!`,
                icon,
                type: 'permanent',
                category
            });
        } else if (level === 25) {
            icon = '💎';
            title = 'Master Rank Achieved!';
            this.addAchievement({
                id: `level_master_${level}`,
                title,
                description: `Reached level ${level} - Master-level skills unlocked!`,
                icon,
                type: 'permanent',
                category
            });
        } else if (level === 50) {
            icon = '👑';
            title = 'Legendary Status!';
            this.addAchievement({
                id: `level_legend_${level}`,
                title,
                description: `Reached level ${level} - Legendary coder status achieved!`,
                icon,
                type: 'permanent',
                category
            });
        } else {
            // Regular level ups are temporary
            this.addAchievement({
                id: `level_up_${Date.now()}`,
                title,
                description: `Welcome to level ${level}!`,
                icon,
                type: 'temporary',
                category
            });
        }
    }

    addXpGainAchievement(xpGained: number, source?: string): void {
        this.addAchievement({
            id: `xp_gain_${Date.now()}`,
            title: `+${xpGained} XP`,
            description: source ? `${source}` : `Gained ${xpGained} experience points`,
            icon: '✨',
            type: 'temporary',
            category: 'milestone',
            data: { xpGained, source }
        });
    }

    addComboAchievement(combo: number): void {
        let title = `${combo}x Combo!`;
        let icon = '🔥';
        let type: Achievement['type'] = 'temporary';

        // Special combo milestones become permanent
        if (combo >= 100) {
            icon = '🌟';
            title = 'Century Combo Master!';
            type = 'permanent';
            this.addAchievement({
                id: `combo_century_${combo}`,
                title,
                description: `Achieved a ${combo}x combo - Incredible consistency!`,
                icon,
                type,
                category: 'combo'
            });
        } else if (combo >= 50) {
            icon = '⚡';
            title = 'Mega Combo!';
            type = 'permanent';
            this.addAchievement({
                id: `combo_mega_${combo}`,
                title,
                description: `Achieved a ${combo}x combo - You're on fire!`,
                icon,
                type,
                category: 'combo'
            });
        } else if (combo % 10 === 0 && combo >= 20) {
            // Every 10 combos past 20 gets a temporary achievement
            this.addAchievement({
                id: `combo_milestone_${Date.now()}`,
                title,
                description: `${combo} consecutive actions - Keep it up!`,
                icon,
                type: 'temporary',
                category: 'combo'
            });
        }
    }

    addBossVictoryAchievement(bossName: string): void {
        this.addAchievement({
            id: `boss_victory_${Date.now()}`,
            title: `${bossName} Defeated!`,
            description: `Successfully completed the ${bossName} challenge`,
            icon: '🏆',
            type: 'permanent',
            category: 'boss'
        });
    }

    /**
     * Load achievements from storage
     */
    private loadAchievements(): void {
        const stored = this.context.globalState.get<AchievementStorage>('codequest.achievements');
        if (stored) {
            this.achievements = {
                temporaryAchievements: stored.temporaryAchievements || [],
                permanentAchievements: stored.permanentAchievements || [],
                lastCleanup: stored.lastCleanup || Date.now()
            };
        }
    }

    /**
     * Save achievements to storage
     */
    private saveAchievements(): void {
        this.context.globalState.update('codequest.achievements', this.achievements);
    }

    private startComboDecaySystem() {
        // Prevent multiple intervals
        if (this.comboDecayTimer) {
            clearInterval(this.comboDecayTimer);
        }
        
        // Start combo decay timer - combo decays faster now (every 3 seconds instead of longer)
        this.comboDecayTimer = setInterval(() => {
            // Skip combo decay if extension is disabled
            if (!this.enabled) return;
            
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
        
        // Initialize date object for reuse
        this._tempDate.setTime(Date.now());
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
        
        // Get stats object from pool or create new one
        this._cachedStats = this.getPooledStats();
        
        // Copy current stats to cached object (avoid object spread for performance)
        this._cachedStats.level = this.stats.level;
        this._cachedStats.xp = this.stats.xp;
        this._cachedStats.xpToNextLevel = this.stats.xpToNextLevel;
        this._cachedStats.dailyStreak = this.stats.dailyStreak;
        this._cachedStats.lastActiveDate = this.stats.lastActiveDate;
        this._cachedStats.totalLinesWritten = this.stats.totalLinesWritten;
        this._cachedStats.combo = this.stats.combo;
        this._cachedStats.maxCombo = this.stats.maxCombo;
        this._cachedStats.bossBattlesWon = this.stats.bossBattlesWon;
        this._cachedStats.currentBossBattle = this.stats.currentBossBattle;
        
        this._statsDirty = false;
        return this._cachedStats;
    }

    addXP(amount: number, reason: string = '') {
        if (!this.enabled) return; // Skip if extension is disabled
        
        this.stats.xp += amount;
        
        // Add XP gain achievement for significant amounts
        if (amount >= 10) {
            this.addXpGainAchievement(amount, reason);
        }
        
        // Check for level up
        while (this.stats.xp >= this.stats.xpToNextLevel) {
            this.levelUp();
        }
        
        this.markStatsDirty();
        this.saveStats();
        
        // XP notifications now handled by achievement system only
    }

    private levelUp() {
        this.stats.xp -= this.stats.xpToNextLevel;
        this.stats.level++;
        this.stats.xpToNextLevel = Math.floor(this.stats.xpToNextLevel * 1.5);
        
        // Add level up achievement
        this.addLevelUpAchievement(this.stats.level);
        
        // Enhanced level up messages with achievements - add to tree view instead of notifications
        let achievementLabel = '';
        let extraReward = '';
        
        if (this.stats.level === 10) {
            achievementLabel = `⭐ EXPERT RANK ACHIEVED! Level ${this.stats.level}`;
            extraReward = ' +50 Bonus XP!';
            this.stats.xp += 50;
        } else if (this.stats.level === 25) {
            achievementLabel = `💎 MASTER RANK ACHIEVED! Level ${this.stats.level}`;
            extraReward = ' +100 Bonus XP!';
            this.stats.xp += 100;
        } else if (this.stats.level === 50) {
            achievementLabel = `👑 LEGENDARY STATUS! Level ${this.stats.level}`;
            extraReward = ' +250 Bonus XP!';
            this.stats.xp += 250;
        } else {
            achievementLabel = `🎉 LEVEL UP! Welcome to Level ${this.stats.level}!`;
        }
        
        // Achievement system now integrated above
    }

    incrementCombo() {
        if (!this.enabled) return; // Skip if extension is disabled
        
        const now = Date.now();
        
        // Rate limiting: prevent combo spam from large text insertions
        if (now - this.lastComboIncrement < this.comboIncrementCooldown) {
            console.log('CodeQuest: Combo increment rate limited, skipping');
            return;
        }
        
        // Track recent increments using circular buffer for memory efficiency
        this.recentIncrements[this.recentIncrementsIndex] = now;
        this.recentIncrementsIndex = (this.recentIncrementsIndex + 1) % this.MAX_RECENT_INCREMENTS;
        
        // Count valid entries in circular buffer (non-zero timestamps)
        let validIncrements = 0;
        let oldestTime = now;
        for (let i = 0; i < this.MAX_RECENT_INCREMENTS; i++) {
            if (this.recentIncrements[i] > 0) {
                validIncrements++;
                if (this.recentIncrements[i] < oldestTime) {
                    oldestTime = this.recentIncrements[i];
                }
            }
        }
        
        // If too many increments in short time, increase cooldown (likely large paste/AI)
        if (validIncrements >= 10) {
            const timeSpan = now - oldestTime;
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
        
        // Trigger multiplier display on every combo increment for visual feedback
        if (this.multiplierCallback) {
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

    // Optimize combo milestone handling with achievement integration
    private handleComboMilestones() {
        const combo = this.stats.combo;
        
        // Add combo achievements for milestones
        this.addComboAchievement(combo);
    }

    breakCombo() {
        // Achievement system removed - no tree view
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
        // Notification now handled by achievement system
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
            
            // Add boss victory achievement
            this.addBossVictoryAchievement(battle.name);
            
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
        // Memory optimization: Reuse date object
        this._tempDate.setTime(Date.now());
        const today = this._tempDate.toDateString();
        
        if (this.stats.lastActiveDate !== today) {
            this._tempDate.setDate(this._tempDate.getDate() - 1);
            const yesterday = this._tempDate.toDateString();
            
            if (this.stats.lastActiveDate === yesterday) {
                this.stats.dailyStreak++;
            } else {
                this.stats.dailyStreak = 1;
            }
            
            this.stats.lastActiveDate = today;
            
            // Achievement system removed - no tree view
        }
    }

    checkDailyStreak() {
        // Memory optimization: Reuse date object
        this._tempDate.setTime(Date.now());
        const today = this._tempDate.toDateString();
        
        this._tempDate.setDate(this._tempDate.getDate() - 1);
        const yesterday = this._tempDate.toDateString();
        
        if (this.stats.lastActiveDate !== today && this.stats.lastActiveDate !== yesterday) {
            if (this.stats.dailyStreak > 0) {
                // Achievement system removed - no tree view
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
        // Also clear achievements when resetting all stats
        this.clearAchievements();
        this.markStatsDirty();
        this.saveStats();
    }

    clearAchievements() {
        this.achievements = {
            temporaryAchievements: [],
            permanentAchievements: [],
            lastCleanup: Date.now()
        };
        this.saveAchievements();
        
        // Trigger UI refresh to show cleared achievements
        if (this.refreshCallback) {
            this.refreshCallback();
        }
    }
}