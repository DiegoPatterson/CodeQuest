# CodeQuest Extension - Testing Guide

## 🧪 Running Tests

### Unit Tests (Jest)
```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with coverage report
npm test -- --coverage
```

### Manual Extension Testing

1. **Launch Extension Development Host**
   - Press `F5` or use "Run Extension" debug configuration
   - This opens a new VS Code window with your extension loaded

2. **What to Test:**

   **✅ Extension Activation:**
   - Look for CodeQuest activity bar icon (🎮)
   - Check for activation message: "🎮 CodeQuest activated! Start your coding adventure!"
   - Verify no console errors in Developer Tools (`Help > Toggle Developer Tools`)

   **✅ Sidebar Functionality:**
   - Click the CodeQuest icon in activity bar
   - Sidebar should display player stats (Level, XP, etc.)
   - Should show "No active boss battle" initially

   **✅ Core Game Mechanics:**
   - Create a new file and start typing code
   - Watch XP increase in sidebar
   - Verify combo counter increases
   - Check that deleting large amounts breaks combo

   **✅ Boss Battles:**
   - Use Command Palette (`Ctrl+Shift+P`) → "CodeQuest: Start Boss Battle"
   - Enter a task name
   - Start writing code and watch progress
   - Use "CodeQuest: Complete Boss Battle" when done

   **✅ Commands Testing:**
   - `CodeQuest: Start Boss Battle` - Should prompt for task name
   - `CodeQuest: Complete Boss Battle` - Should complete current battle
   - `CodeQuest: Reset All Stats` - Should reset all progress

   **✅ Edge Cases:**
   - Test copy-paste detection (paste large code blocks quickly)
   - Test daily streak functionality
   - Test level-up mechanics (gain 100+ XP)

## 🔍 What to Look For

### Good Signs ✅
- No console errors
- Sidebar updates in real-time
- XP/levels increase when coding
- Boss battles track progress
- Stats persist between sessions

### Red Flags ❌
- "No data provider registered" errors
- Sidebar shows empty/broken content
- XP doesn't increase when typing
- Console errors about missing providers
- Extension fails to activate

## 🐛 Debugging Tips

### Common Issues:
1. **Extension not activating**: Check `extension.ts` console logs
2. **Sidebar not loading**: Verify WebviewViewProvider registration
3. **Stats not updating**: Check GameState event listeners
4. **Build errors**: Run `npm run compile` to check TypeScript

### Developer Tools:
- Open with `Help > Toggle Developer Tools`
- Check Console for errors
- Monitor Network tab for failed resource loads

## 📊 Test Coverage

Current test coverage includes:
- **GameState**: Player stats, XP system, boss battles, level progression
- **CodeAnalyzer**: Line detection, copy-paste detection, combo system

### Adding New Tests:
1. Create test files in `tests/` folder
2. Follow naming pattern: `*.test.ts`
3. Use Jest and the provided mocks
4. Run tests with `npm test`

## 🚀 Performance Testing

Monitor these metrics during development:
- Extension activation time
- Sidebar responsiveness
- Memory usage during long coding sessions
- CPU usage when analyzing code changes

## 📝 Manual Test Checklist

- [ ] Extension activates without errors
- [ ] CodeQuest icon appears in activity bar
- [ ] Sidebar loads and displays stats
- [ ] XP increases when writing code
- [ ] Combo system works correctly
- [ ] Boss battles can be started and completed
- [ ] All commands work via Command Palette
- [ ] Stats reset functionality works
- [ ] Copy-paste detection works
- [ ] Level-up notifications appear
- [ ] No memory leaks during extended use