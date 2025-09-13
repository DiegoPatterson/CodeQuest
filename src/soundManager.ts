import * as vscode from 'vscode';

export interface SoundConfig {
    enabled: boolean;
    volume: number; // 0-100
}

export class SoundManager {
    private config: SoundConfig;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = this.loadConfig();
    }

    private loadConfig(): SoundConfig {
        const config = vscode.workspace.getConfiguration('codequest');
        return {
            enabled: config.get('sounds.enabled', true),
            volume: config.get('sounds.volume', 50)
        };
    }

    public updateConfig(): void {
        this.config = this.loadConfig();
    }

    public isEnabled(): boolean {
        return this.config.enabled;
    }

    public getVolume(): number {
        return this.config.volume;
    }

    // Play sound using HTML5 audio in webview
    public playSound(soundName: string, webview?: vscode.Webview): void {
        if (!this.config.enabled) {
            return;
        }

        console.log(`CodeQuest: Playing sound: ${soundName} (Volume: ${this.config.volume}%)`);
        
        if (webview) {
            // Send message to webview to play sound
            webview.postMessage({
                type: 'playSound',
                soundName: soundName,
                volume: this.config.volume / 100
            });
        }
    }

    // Predefined sounds
    public playCombatHit(webview?: vscode.Webview): void {
        this.playSound('combat-hit', webview);
    }

    public playLevelUp(webview?: vscode.Webview): void {
        this.playSound('level-up', webview);
    }

    public playAchievement(webview?: vscode.Webview): void {
        this.playSound('achievement', webview);
    }

    public playBossHit(webview?: vscode.Webview): void {
        this.playSound('boss-hit', webview);
    }

    public playComboMilestone(webview?: vscode.Webview): void {
        this.playSound('combo-milestone', webview);
    }

    public playWizardAppear(webview?: vscode.Webview): void {
        this.playSound('wizard-appear', webview);
    }

    // Toggle sound effects
    public async toggleSounds(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codequest');
        const newValue = !this.config.enabled;
        await config.update('sounds.enabled', newValue, vscode.ConfigurationTarget.Global);
        this.updateConfig();
        
        const status = newValue ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`🔊 CodeQuest sounds ${status}!`);
    }

    // Adjust volume
    public async setVolume(volume: number): Promise<void> {
        const clampedVolume = Math.max(0, Math.min(100, volume));
        const config = vscode.workspace.getConfiguration('codequest');
        await config.update('sounds.volume', clampedVolume, vscode.ConfigurationTarget.Global);
        this.updateConfig();
        
        vscode.window.showInformationMessage(`🔊 CodeQuest volume set to ${clampedVolume}%`);
    }
}