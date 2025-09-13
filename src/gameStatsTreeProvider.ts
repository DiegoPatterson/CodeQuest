import * as vscode from 'vscode';
import { GameState } from './gameState';
import { VisualEngine } from './visualEngine';

export class GameStatsTreeProvider implements vscode.TreeDataProvider<GameStatItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<GameStatItem | undefined | null | void> = new vscode.EventEmitter<GameStatItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<GameStatItem | undefined | null | void> = this._onDidChangeTreeData.event;
    
    private visualEngine: VisualEngine;
    private lastWordsTyped: number = 0;

    constructor(private gameState: GameState) {
        console.log('CodeQuest: GameStatsTreeProvider created');
        this.visualEngine = new VisualEngine(gameState);
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
            
            // Get epic visual from visual engine
            const visualLines = this.visualEngine.updateVisual(this.lastWordsTyped);
            
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
            
            // Add visual scene first
            visualLines.forEach((line, index) => {
                if (line.trim()) {
                    items.push(new GameStatItem(line, vscode.TreeItemCollapsibleState.None));
                }
            });
            
            // Add separator
            items.push(new GameStatItem("═══════════════════", vscode.TreeItemCollapsibleState.None));
            
            // Add stats
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
                
                // Auto-generate checkpoints based on progress
                const totalLines = stats.currentBossBattle.targetLines;
                const currentLines = stats.currentBossBattle.currentLines;
                const checkpoints = [
                    { threshold: Math.floor(totalLines * 0.25), name: "🎯 First Quarter" },
                    { threshold: Math.floor(totalLines * 0.5), name: "🎯 Halfway Point" },
                    { threshold: Math.floor(totalLines * 0.75), name: "🎯 Three Quarters" },
                    { threshold: totalLines, name: "🏆 VICTORY!" }
                ];
                
                checkpoints.forEach(checkpoint => {
                    const completed = currentLines >= checkpoint.threshold;
                    const status = completed ? "✅" : "⏳";
                    const item = new GameStatItem(
                        `${status} ${checkpoint.name} (${checkpoint.threshold} lines)`,
                        vscode.TreeItemCollapsibleState.None
                    );
                    if (completed) {
                        item.description = "Completed!";
                    }
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