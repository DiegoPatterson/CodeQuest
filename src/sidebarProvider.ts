import * as vscode from 'vscode';
import { GameState } from './gameState';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private gameState: GameState
    ) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        this.refresh();

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'startBossBattle':
                    vscode.commands.executeCommand('codequest.startBossBattle');
                    break;
                case 'completeBossBattle':
                    vscode.commands.executeCommand('codequest.completeBossBattle');
                    break;
                case 'resetStats':
                    vscode.commands.executeCommand('codequest.resetStats');
                    break;
            }
        });
    }

    refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview();
        }
    }

    private _getHtmlForWebview() {
        const stats = this.gameState.getStats();
        const xpPercentage = (stats.xp / stats.xpToNextLevel) * 100;
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodeQuest</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 10px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
        }
        .level {
            font-size: 24px;
            font-weight: bold;
            color: #ffd700;
        }
        .xp-bar {
            width: 100%;
            height: 20px;
            background: #333;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .xp-fill {
            height: 100%;
            background: linear-gradient(45deg, #4CAF50, #8BC34A);
            width: ${xpPercentage}%;
            transition: width 0.3s ease;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            padding: 5px 0;
            border-bottom: 1px solid #333;
        }
        .stat-label {
            font-weight: bold;
        }
        .combo {
            color: ${stats.combo > 10 ? '#ff6b35' : stats.combo > 5 ? '#ffd23f' : '#ffffff'};
            font-weight: bold;
        }
        .boss-battle {
            background: #2d1b69;
            border: 2px solid #8b5cf6;
            border-radius: 8px;
            padding: 10px;
            margin: 10px 0;
        }
        .boss-name {
            color: #fbbf24;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .boss-progress {
            width: 100%;
            height: 15px;
            background: #1f2937;
            border-radius: 8px;
            overflow: hidden;
        }
        .boss-fill {
            height: 100%;
            background: linear-gradient(45deg, #ef4444, #dc2626);
            transition: width 0.3s ease;
        }
        .button {
            background: #0d7377;
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
            width: calc(100% - 10px);
        }
        .button:hover {
            background: #14a085;
        }
        .streak {
            color: #f59e0b;
            font-size: 18px;
        }
        .achievement {
            background: #065f46;
            border-left: 4px solid #10b981;
            padding: 8px;
            margin: 5px 0;
            border-radius: 0 4px 4px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="level">⚔️ Level ${stats.level} ⚔️</div>
        <div class="xp-bar">
            <div class="xp-fill"></div>
        </div>
        <div>${stats.xp}/${stats.xpToNextLevel} XP</div>
    </div>

    <div class="stat-row">
        <span class="stat-label">🔥 Daily Streak:</span>
        <span class="streak">${stats.dailyStreak} days</span>
    </div>

    <div class="stat-row">
        <span class="stat-label">⚡ Current Combo:</span>
        <span class="combo">${stats.combo}x</span>
    </div>

    <div class="stat-row">
        <span class="stat-label">🏆 Best Combo:</span>
        <span>${stats.maxCombo}x</span>
    </div>

    <div class="stat-row">
        <span class="stat-label">📝 Lines Written:</span>
        <span>${stats.totalLinesWritten}</span>
    </div>

    <div class="stat-row">
        <span class="stat-label">🐉 Bosses Defeated:</span>
        <span>${stats.bossBattlesWon}</span>
    </div>

    ${stats.currentBossBattle ? `
    <div class="boss-battle">
        <div class="boss-name">🐉 ${stats.currentBossBattle.name}</div>
        <div class="boss-progress">
            <div class="boss-fill" style="width: ${(stats.currentBossBattle.currentLines / stats.currentBossBattle.targetLines) * 100}%"></div>
        </div>
        <div>${stats.currentBossBattle.currentLines}/${stats.currentBossBattle.targetLines} lines</div>
        ${stats.currentBossBattle.currentLines >= stats.currentBossBattle.targetLines ? 
            '<button class="button" onclick="completeBossBattle()">🎉 Claim Victory!</button>' : ''
        }
    </div>
    ` : '<button class="button" onclick="startBossBattle()">🐉 Start Boss Battle</button>'}

    ${stats.level >= 5 && stats.dailyStreak >= 7 ? 
        '<div class="achievement">🏅 Week Warrior - 7 day streak achieved!</div>' : ''}
    
    ${stats.maxCombo >= 50 ? 
        '<div class="achievement">🔥 Combo Master - 50x combo achieved!</div>' : ''}

    <button class="button" onclick="resetStats()" style="background: #dc2626; margin-top: 20px;">
        🔄 Reset Stats
    </button>

    <script>
        const vscode = acquireVsCodeApi();
        
        function startBossBattle() {
            vscode.postMessage({ type: 'startBossBattle' });
        }
        
        function completeBossBattle() {
            vscode.postMessage({ type: 'completeBossBattle' });
        }
        
        function resetStats() {
            vscode.postMessage({ type: 'resetStats' });
        }
    </script>
</body>
</html>`;
    }
}