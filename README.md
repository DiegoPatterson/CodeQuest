# CodeQuest - Gamify Your VS Code Experience

Transform your coding into an RPG adventure with levels, streaks, boss battles, and combo tracking!

> ⚠️ **AI-Generated Project Notice**: This extension was created with significant assistance from AI tools. While functional and tested, please review the code before use in production environments.

## Features
- 🎮 **Level up as you code** - Gain XP for every line written
- 🔥 **Daily streak tracking** - Keep your coding momentum going
- ⚡ **Combo system** - Build streaks for continuous coding
- 🐉 **Boss battles** - Set coding challenges with target line goals
- 🧙‍♂️ **Wizard system** - Random appearances with 15-second idle timer
- 📊 **Beautiful sidebar** - Real-time stats with knight/wizard animations
- 🎯 **Rate limiting** - Smart detection prevents spam and copy-paste abuse
- 🎛️ **Toggle on/off** - Disable RPG mode when you need distraction-free coding

## Installation

### Option 1: Install Pre-built Extension (Recommended)
1. Download the latest `codequest-x.x.x.vsix` file from releases
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. Type "Extensions: Install from VSIX"
5. Select the downloaded `.vsix` file
6. Restart VS Code

### Option 2: Build from Source
1. Clone this repository:
   ```bash
   git clone https://github.com/DiegoPatterson/CodeQuest.git
   cd CodeQuest
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run compile
   ```
4. Package the extension:
   ```bash
   npm install -g @vscode/vsce
   vsce package --allow-star-activation
   ```
5. Install the generated `.vsix` file using Option 1 above

### Option 3: Development Mode
1. Follow steps 1-3 from Option 2
2. Press `F5` to launch extension in debug mode
3. A new VS Code window will open with the extension loaded

## Usage
- **Open the CodeQuest sidebar** - Look for the knight icon in the activity bar
- **Start coding** - Gain XP automatically as you write code
- **Track your stats** - View level, XP, combo, and daily streaks
- **Start boss battles** - Use Command Palette (`Ctrl+Shift+P`) → "CodeQuest: Start Boss Battle"
- **Watch for the wizard** - Random appearances every few minutes in idle state
- **Build combos** - Continuous typing builds your combo multiplier

## Commands
Access these via Command Palette (`Ctrl+Shift+P`):
- `CodeQuest: Toggle RPG Mode` - **Enable/disable the extension** (keep VS Code performance when needed)
- `CodeQuest: Start Boss Battle` - Begin a coding challenge
- `CodeQuest: Complete Boss Battle` - Mark current battle as complete
- `CodeQuest: Kill Boss Battle` - Cancel current battle
- `CodeQuest: Reset All Stats` - Clear all progress (use carefully!)
- `CodeQuest: Trigger Wizard` - Manually summon the wizard
- `CodeQuest: Kill Wizard` - Dismiss the wizard

## Development

### Running Tests
```bash
npm test
```

### Building
```bash
npm run compile
```

### Packaging
```bash
vsce package --allow-star-activation
```

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Build and test the extension
6. Submit a pull request

## License
MIT License - see LICENSE file for details

## Disclaimer
This project was created with substantial assistance from AI tools. While it has been tested and functions as intended, users should review the code and use at their own discretion. The extension tracks coding activity and stores statistics locally in VS Code's global state.