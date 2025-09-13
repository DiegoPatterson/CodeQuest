import * as vscode from 'vscode';

export class TestWebviewProvider implements vscode.WebviewViewProvider {
    
    resolveWebviewView(webviewView: vscode.WebviewView): Thenable<void> | void {
        console.log('TEST: resolveWebviewView called!');
        
        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.html = `
        <html>
        <body>
            <h1>TEST WEBVIEW WORKS!</h1>
            <p>If you see this, the webview provider is working.</p>
        </body>
        </html>
        `;
    }
}