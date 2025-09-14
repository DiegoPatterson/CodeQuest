/**
 * Long-term Achievement System Test Script
 * Run this in VS Code's Developer Console to simulate extended usage
 */

class AchievementStressTester {
    constructor() {
        this.testResults = {
            achievementsGenerated: 0,
            memoryUsage: [],
            errors: [],
            startTime: Date.now()
        };
        this.isRunning = false;
    }

    // Test 1: Rapid Achievement Generation
    async testRapidAchievements(count = 50) {
        console.log(`🚀 Starting rapid achievement test (${count} achievements)...`);
        
        for (let i = 0; i < count; i++) {
            try {
                // Simulate XP gains that trigger achievements
                if (typeof gameState !== 'undefined') {
                    gameState.addXP(15, `Stress test ${i + 1}`);
                }
                this.testResults.achievementsGenerated++;
                
                // Small delay to prevent browser freezing
                await this.delay(50);
            } catch (error) {
                this.testResults.errors.push(`Achievement ${i}: ${error.message}`);
            }
        }
        
        console.log(`✅ Generated ${this.testResults.achievementsGenerated} achievements`);
        this.recordMemoryUsage();
    }

    // Test 2: Long-running Memory Test
    startMemoryMonitoring(durationMinutes = 60) {
        console.log(`📊 Starting memory monitoring for ${durationMinutes} minutes...`);
        this.isRunning = true;
        
        const interval = setInterval(() => {
            if (!this.isRunning) {
                clearInterval(interval);
                return;
            }
            
            this.recordMemoryUsage();
            
            // Generate occasional achievements to simulate normal usage
            if (Math.random() < 0.3 && typeof gameState !== 'undefined') {
                gameState.addXP(12, 'Memory test activity');
            }
        }, 30000); // Every 30 seconds
        
        // Stop after specified duration
        setTimeout(() => {
            this.stopMemoryMonitoring();
            clearInterval(interval);
        }, durationMinutes * 60 * 1000);
    }

    stopMemoryMonitoring() {
        this.isRunning = false;
        console.log('🛑 Memory monitoring stopped');
        this.generateReport();
    }

    // Test 3: Achievement Cleanup Verification
    async testCleanupBehavior() {
        console.log('🧹 Testing achievement cleanup behavior...');
        
        // Generate 15 temporary achievements (should trigger cleanup)
        for (let i = 0; i < 15; i++) {
            if (typeof gameState !== 'undefined') {
                gameState.addXP(11, `Cleanup test ${i + 1}`);
            }
            await this.delay(100);
        }
        
        // Check achievement count
        if (typeof gameState !== 'undefined') {
            const achievements = gameState.getAchievementsForDisplay();
            console.log(`Temporary achievements: ${achievements.temporary.length} (should be ≤ 10)`);
            console.log(`Permanent achievements: ${achievements.permanent.length}`);
        }
        
        // Wait for expiration (30+ seconds)
        console.log('⏳ Waiting 35 seconds for achievement expiration...');
        await this.delay(35000);
        
        if (typeof gameState !== 'undefined') {
            const achievementsAfter = gameState.getAchievementsForDisplay();
            console.log(`Achievements after expiration: ${achievementsAfter.temporary.length} (should be fewer)`);
        }
    }

    // Test 4: Persistence Test
    testPersistence() {
        console.log('💾 Testing achievement persistence...');
        
        if (typeof gameState !== 'undefined') {
            // Add a permanent achievement
            gameState.addAchievement({
                id: `persistence_test_${Date.now()}`,
                title: 'Persistence Test Achievement',
                description: 'This should survive VS Code restart',
                icon: '🧪',
                type: 'permanent',
                category: 'milestone'
            });
            
            console.log('✅ Added persistence test achievement');
            console.log('🔄 Please restart VS Code and check if this achievement persists');
        }
    }

    // Utility Methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    recordMemoryUsage() {
        if (typeof performance !== 'undefined' && performance.memory) {
            this.testResults.memoryUsage.push({
                timestamp: Date.now(),
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            });
        }
    }

    generateReport() {
        const duration = (Date.now() - this.testResults.startTime) / 1000 / 60; // minutes
        
        console.log('\n📋 ACHIEVEMENT SYSTEM TEST REPORT');
        console.log('=====================================');
        console.log(`Test Duration: ${duration.toFixed(1)} minutes`);
        console.log(`Achievements Generated: ${this.testResults.achievementsGenerated}`);
        console.log(`Errors Encountered: ${this.testResults.errors.length}`);
        
        if (this.testResults.memoryUsage.length > 0) {
            const memoryData = this.testResults.memoryUsage;
            const startMemory = memoryData[0].usedJSHeapSize;
            const endMemory = memoryData[memoryData.length - 1].usedJSHeapSize;
            const memoryDelta = ((endMemory - startMemory) / startMemory * 100).toFixed(2);
            
            console.log(`Memory Change: ${memoryDelta}%`);
            console.log(`Start Memory: ${(startMemory / 1024 / 1024).toFixed(2)} MB`);
            console.log(`End Memory: ${(endMemory / 1024 / 1024).toFixed(2)} MB`);
        }
        
        if (this.testResults.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            this.testResults.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        console.log('\n✅ Test completed successfully!');
    }

    // Run all tests in sequence
    async runAllTests() {
        console.log('🎯 Starting comprehensive achievement system test...\n');
        
        try {
            await this.testRapidAchievements(25);
            await this.delay(2000);
            
            await this.testCleanupBehavior();
            await this.delay(2000);
            
            this.testPersistence();
            
            console.log('\n🎉 All tests completed! Check the sidebar for visual results.');
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        }
    }
}

// Create global tester instance
window.achievementTester = new AchievementStressTester();

// Usage instructions
console.log(`
🧪 ACHIEVEMENT SYSTEM LONG-TERM TESTER LOADED

Quick Tests:
- achievementTester.runAllTests() - Run comprehensive test suite
- achievementTester.testRapidAchievements(50) - Generate 50 achievements rapidly
- achievementTester.testCleanupBehavior() - Test cleanup and expiration
- achievementTester.testPersistence() - Test data persistence
- achievementTester.startMemoryMonitoring(60) - Monitor for 60 minutes

Long-term Tests:
- achievementTester.startMemoryMonitoring(480) - 8-hour memory test
- Leave VS Code running overnight with periodic testing

Tips:
1. Open VS Code Developer Console (Help > Toggle Developer Tools)
2. Run tests while actively coding to simulate real usage
3. Monitor the sidebar for visual confirmation
4. Check memory usage in Task Manager during long tests
`);