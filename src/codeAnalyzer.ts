import * as vscode from 'vscode';
import { GameState } from './gameState';

export interface AnalysisResult {
    wordsAdded: number;
    linesAdded: number;
    charactersAdded: number;
    aiDetected: boolean;
    hasSuspiciousPaste: boolean;
}

export class CodeAnalyzer {
    private lastChangeTime: number = 0;
    private rapidChangeThreshold = 500; // ms
    private lastLineCount: number = 0;
    
    constructor(private gameState: GameState) {}

    analyzeChange(event: vscode.TextDocumentChangeEvent): AnalysisResult | null {
        if (event.contentChanges.length === 0) return null;

        const now = Date.now();
        let totalLinesAdded = 0;
        let totalCharactersAdded = 0;
        let wordsAdded = 0;
        let hasSuspiciousPaste = false;
        let aiDetected = false;

        // Get current line count of the document
        const currentLineCount = event.document.lineCount;
        const newLinesFromLineCount = Math.max(0, currentLineCount - this.lastLineCount);
        this.lastLineCount = currentLineCount;

        for (const change of event.contentChanges) {
            const linesAdded = change.text.split('\n').length - 1;
            totalLinesAdded += linesAdded;
            
            // Count characters (excluding whitespace)
            const nonWhitespaceChars = change.text.replace(/\s/g, '').length;
            totalCharactersAdded += nonWhitespaceChars;
            
            // Count words (simple word detection)
            const words = change.text.match(/\b\w+\b/g);
            if (words) {
                wordsAdded += words.length;
            }

            // Detect AI patterns (very basic detection)
            const aiPatterns = [
                /\/\/ AI generated/i,
                /\/\* AI generated/i,
                /# AI generated/i,
                /copilot/i,
                /chatgpt/i,
                /artificial intelligence/i
            ];
            
            if (aiPatterns.some(pattern => pattern.test(change.text))) {
                aiDetected = true;
            }

            // Detect potential copy-paste (large additions in short time)
            if (linesAdded > 10 && (now - this.lastChangeTime) < this.rapidChangeThreshold) {
                hasSuspiciousPaste = true;
            }
        }

        this.lastChangeTime = now;

        // Award XP for new lines (either from \n characters or actual line count increase)
        const lineReward = Math.max(totalLinesAdded, newLinesFromLineCount);
        if (lineReward > 0) {
            if (hasSuspiciousPaste) {
                this.gameState.detectCopyPaste(lineReward);
            } else {
                this.gameState.addLinesWritten(lineReward);
                // Award 5 XP per new line
                this.gameState.addXP(lineReward * 5, `(${lineReward} lines)`);
            }
        }

        // Award combo and XP for words written (if not copy-paste)
        if (wordsAdded > 0 && !hasSuspiciousPaste && totalCharactersAdded > 0) {
            for (let i = 0; i < wordsAdded; i++) {
                this.gameState.incrementCombo();
            }
            // Award 2 XP per word
            this.gameState.addXP(wordsAdded * 2, `(${wordsAdded} words)`);
        }

        // Award small XP for any meaningful typing (not just words/lines)
        if (totalCharactersAdded > 0 && !hasSuspiciousPaste && wordsAdded === 0 && lineReward === 0) {
            // Award 1 XP for every 3 characters typed
            const charXP = Math.floor(totalCharactersAdded / 3);
            if (charXP > 0) {
                this.gameState.addXP(charXP, `(typing)`);
            }
        }

        // Break combo if user deletes significant content
        const deletedLines = event.contentChanges.reduce((acc, change) => {
            return acc + (change.rangeLength > 50 ? 5 : 0);
        }, 0);
        
        if (deletedLines > 3) {
            this.gameState.breakCombo();
        }

        return {
            wordsAdded,
            linesAdded: Math.max(totalLinesAdded, newLinesFromLineCount),
            charactersAdded: totalCharactersAdded,
            aiDetected,
            hasSuspiciousPaste
        };
    }
}
