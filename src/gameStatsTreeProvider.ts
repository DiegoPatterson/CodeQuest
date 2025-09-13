import * as vscode from 'vscode';
import { GameState } from './gameState';
import { VisualEngine } from './visualEngine';

interface TemporaryAchievement {
    id: string;
    label: string;
    timestamp: number;
    displayDuration: number; // in milliseconds
}

export class GameStatsTreeProvider implements vscode.TreeDataProvider<GameStatItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<GameStatItem | undefined | null | void> = new vscode.EventEmitter<GameStatItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<GameStatItem | undefined | null | void> = this._onDidChangeTreeData.event;
    
    private visualEngine: VisualEngine;
    private lastWordsTyped: number = 0;
    private temporaryAchievements: TemporaryAchievement[] = [];
    private cleanupTimer: NodeJS.Timeout | null = null;
    private readonly ACHIEVEMENT_DISPLAY_DURATION = 30000; // 30 seconds

    constructor(private gameState: GameState) {
        console.log('CodeQuest: GameStatsTreeProvider created');
        this.visualEngine = new VisualEngine(gameState);
        this.startCleanupTimer();
    }

    private startCleanupTimer(): void {
        // Clean up old achievements every 5 seconds
        this.cleanupTimer = setInterval(() => {
            this.cleanupOldAchievements();
        }, 5000);
    }

    private cleanupOldAchievements(): void {
        const now = Date.now();
        const initialCount = this.temporaryAchievements.length;
        
        this.temporaryAchievements = this.temporaryAchievements.filter(achievement => {
            return (now - achievement.timestamp) < achievement.displayDuration;
        });
        
        // If we removed any achievements, refresh the tree
        if (this.temporaryAchievements.length !== initialCount) {
            console.log(`CodeQuest: Cleaned up ${initialCount - this.temporaryAchievements.length} old achievements`);
            this._onDidChangeTreeData.fire();
        }
    }

    private addTemporaryAchievement(id: string, label: string, duration: number = this.ACHIEVEMENT_DISPLAY_DURATION): void {
        // Check if this achievement already exists
        const existingIndex = this.temporaryAchievements.findIndex(a => a.id === id);
        if (existingIndex !== -1) {
            // Update existing achievement timestamp
            this.temporaryAchievements[existingIndex].timestamp = Date.now();
        } else {
            // Add new achievement
            this.temporaryAchievements.push({
                id,
                label,
                timestamp: Date.now(),
                displayDuration: duration
            });
            
            // Limit to max 1 achievement - remove oldest if exceeded
            const MAX_ACHIEVEMENTS = 1;
            if (this.temporaryAchievements.length > MAX_ACHIEVEMENTS) {
                // Sort by timestamp (oldest first) and remove the oldest
                this.temporaryAchievements.sort((a, b) => a.timestamp - b.timestamp);
                const removed = this.temporaryAchievements.splice(0, this.temporaryAchievements.length - MAX_ACHIEVEMENTS);
                console.log(`CodeQuest: Removed ${removed.length} old achievements to maintain max of ${MAX_ACHIEVEMENTS}`);
            }
        }
        this._onDidChangeTreeData.fire();
    }

    public dispose(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    refresh(wordsTyped: number = 0, hasAI: boolean = false): void {
        console.log('CodeQuest: TreeProvider refresh called');
        this.lastWordsTyped = wordsTyped;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: GameStatItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: GameStatItem): Thenable<GameStatItem[]> {
        console.log('CodeQuest: getChildren called');
        
        if (!element) {
            const stats = this.gameState.getStats();
            console.log('CodeQuest: Got stats:', stats);
            
            // Calculate progress bars using Unicode blocks
            const xpPercentage = Math.floor((stats.xp / stats.xpToNextLevel) * 10);
            const xpBar = '█'.repeat(xpPercentage) + '▒'.repeat(10 - xpPercentage);
            
            // Combo visual effects
            let comboDisplay = `🔥 Combo: ${stats.combo}x`;
            if (stats.combo > 50) comboDisplay = `🌟 MEGA COMBO: ${stats.combo}x`;
            else if (stats.combo > 20) comboDisplay = `⚡ SUPER COMBO: ${stats.combo}x`;
            else if (stats.combo > 10) comboDisplay = `🔥 HOT COMBO: ${stats.combo}x`;
            
            // Level display with rank
            let levelDisplay = `🏆 Level ${stats.level}`;
            if (stats.level >= 50) levelDisplay = `👑 LEGEND Level ${stats.level}`;
            else if (stats.level >= 25) levelDisplay = `💎 MASTER Level ${stats.level}`;
            else if (stats.level >= 10) levelDisplay = `⭐ EXPERT Level ${stats.level}`;

            const items: GameStatItem[] = [];
            
            // Show extension status first
            const enabledStatus = this.gameState.isEnabled() ? 
                "🎮 RPG Mode: ON" : "😴 RPG Mode: OFF";
            items.push(new GameStatItem(enabledStatus, vscode.TreeItemCollapsibleState.None));
            
            // Only show stats - NO ASCII art
            items.push(new GameStatItem(levelDisplay, vscode.TreeItemCollapsibleState.None));
            items.push(new GameStatItem(`⭐ XP: ${stats.xp}/${stats.xpToNextLevel} ${xpBar}`, vscode.TreeItemCollapsibleState.None));
            items.push(new GameStatItem(comboDisplay, vscode.TreeItemCollapsibleState.None));
            items.push(new GameStatItem(`💪 Max Combo: ${stats.maxCombo}x`, vscode.TreeItemCollapsibleState.None));
            items.push(new GameStatItem(`📝 Lines Written: ${stats.totalLinesWritten}`, vscode.TreeItemCollapsibleState.None));
            items.push(new GameStatItem(`🎯 Daily Streak: ${stats.dailyStreak} days`, vscode.TreeItemCollapsibleState.None));
            items.push(new GameStatItem(`🐉 Bosses Defeated: ${stats.bossBattlesWon}`, vscode.TreeItemCollapsibleState.None));
            
            // Add boss battle checkpoints if active
            if (stats.currentBossBattle) {
                items.push(new GameStatItem("═══ BOSS OBJECTIVES ═══", vscode.TreeItemCollapsibleState.None));
                
                // Auto-generate checkpoints based on progress and add as temporary achievements when completed
                const totalLines = stats.currentBossBattle.targetLines;
                const currentLines = stats.currentBossBattle.currentLines;
                const checkpoints = [
                    { threshold: Math.floor(totalLines * 0.25), name: "🎯 First Quarter", id: "quarter" },
                    { threshold: Math.floor(totalLines * 0.5), name: "🎯 Halfway Point", id: "halfway" },
                    { threshold: Math.floor(totalLines * 0.75), name: "🎯 Three Quarters", id: "threequarter" },
                    { threshold: totalLines, name: "🏆 VICTORY!", id: "victory" }
                ];
                
                checkpoints.forEach(checkpoint => {
                    const completed = currentLines >= checkpoint.threshold;
                    
                    if (completed) {
                        // Add completed checkpoint as temporary achievement (20 seconds display)
                        this.addTemporaryAchievement(
                            `checkpoint_${checkpoint.id}`,
                            `✅ ${checkpoint.name} (${checkpoint.threshold} lines) Completed!`,
                            20000 // 20 seconds
                        );
                    } else {
                        // Only show incomplete checkpoints in the permanent list
                        const item = new GameStatItem(
                            `⏳ ${checkpoint.name} (${checkpoint.threshold} lines)`,
                            vscode.TreeItemCollapsibleState.None
                        );
                        items.push(item);
                    }
                });
            }
            
            // Add temporary achievements (they will auto-cleanup after their duration)
            if (this.temporaryAchievements.length > 0) {
                items.push(new GameStatItem("═══ RECENT ACHIEVEMENTS ═══", vscode.TreeItemCollapsibleState.None));
                this.temporaryAchievements.forEach(achievement => {
                    const timeLeft = Math.ceil((achievement.displayDuration - (Date.now() - achievement.timestamp)) / 1000);
                    const item = new GameStatItem(achievement.label, vscode.TreeItemCollapsibleState.None);
                    item.description = `${timeLeft}s remaining`;
                    items.push(item);
                });
            }
            
            return Promise.resolve(items);
        }
        
        return Promise.resolve([]);
    }
}

export class GameStatItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = this.label;
    }
}