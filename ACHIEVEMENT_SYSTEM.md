# Achievement System Documentation

## Overview
The CodeQuest Achievement System provides visual feedback for coding milestones and accomplishments through a dedicated sidebar section that displays both temporary and permanent achievements.

## Achievement Types

### Temporary Achievements ⚡
- **Duration**: 30 seconds before auto-removal
- **Max Count**: 10 achievements (oldest removed when limit exceeded)
- **Examples**:
  - XP gain notifications (+10 XP or more)
  - Regular level ups (non-milestone levels)
  - Combo milestones (every 10 combos past 20)

### Permanent Achievements 💎
- **Duration**: Persistent until manually cleared
- **Storage**: Saved in VS Code's global state
- **Examples**:
  - Level milestones (Expert at 10, Master at 25, Legend at 50)
  - Major combo achievements (50x+ combos)
  - Boss battle victories
  - Special accomplishments

## Visual Design

### Theme Consistency
- **Container**: Metallic gradient background matching extension's medieval theme
- **Temporary**: Wooden brown styling with pulsing animation
- **Permanent**: Green gradient indicating lasting accomplishments
- **Icons**: Emoji-based for clear visual identification

### Animations
- **Temporary**: Subtle pulsing effect to indicate they will expire
- **Fade Bar**: Progressive fade animation showing remaining time
- **Hover**: Slight translation effect for interactivity

## Technical Implementation

### Data Structure
```typescript
interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    type: 'temporary' | 'permanent';
    timestamp: number;
    category?: 'level' | 'combo' | 'boss' | 'streak' | 'milestone';
    data?: any;
}
```

### Integration Points
1. **XP Gain**: `addXP()` method triggers for gains ≥10 XP
2. **Level Up**: `levelUp()` method triggers appropriate achievement type
3. **Combo Milestones**: `handleComboMilestones()` triggers combo achievements
4. **Boss Battles**: `completeBossBattle()` triggers victory achievements

### Memory Management
- Automatic cleanup of expired temporary achievements every 60 seconds
- Circular buffer logic prevents excessive temporary achievement accumulation
- Efficient storage using VS Code's globalState API

## Usage

### For Users
1. Achievements appear automatically as you code
2. Temporary achievements show recent activity
3. Permanent achievements track major milestones
4. No configuration required - works out of the box

### For Developers
```typescript
// Add a custom achievement
gameState.addAchievement({
    id: 'custom_achievement',
    title: 'Custom Achievement',
    description: 'You did something awesome!',
    icon: '🎉',
    type: 'permanent',
    category: 'milestone'
});
```

## Testing
Run the included `test-achievements.js` file or:
1. Type continuously to trigger XP and combo achievements
2. Level up to see milestone achievements
3. Complete boss battles for victory achievements
4. Wait 30 seconds to see temporary achievements expire

## Future Enhancements
- Achievement categories and filtering
- Achievement sharing functionality
- Custom achievement creation UI
- Achievement statistics and analytics