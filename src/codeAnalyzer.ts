import * as vscode from 'vscode';
import { GameState } from './gameState';

export class CodeAnalyzer {
    private lastChangeTime: number = 0;
    private rapidChangeThreshold = 500; // ms
    
    constructor(private gameState: GameState) {}

    analyzeChange(event: vscode.TextDocumentChangeEvent) {
        if (event.contentChanges.length === 0) return;

        const now = Date.now();
        let totalLinesAdded = 0;
        let hasSuspiciousPaste = false;

        for (const change of event.contentChanges) {
            const linesAdded = change.text.split('\n').length - 1;
            totalLinesAdded += linesAdded;

            // Detect potential copy-paste (large additions in short time)
            if (linesAdded > 10 && (now - this.lastChangeTime) < this.rapidChangeThreshold) {
                hasSuspiciousPaste = true;
            }
        }

        this.lastChangeTime = now;

        if (totalLinesAdded > 0) {
            if (hasSuspiciousPaste) {
                this.gameState.detectCopyPaste(totalLinesAdded);
            } else {
                this.gameState.addLinesWritten(totalLinesAdded);
            }
        }

        // Break combo if user deletes significant content
        const deletedLines = event.contentChanges.reduce((acc, change) => {
            return acc + (change.rangeLength > 50 ? 5 : 0);
        }, 0);
        
        if (deletedLines > 3) {
            this.gameState.breakCombo();
        }
    }
}