// Sound Effects Utility
// Menggunakan Web Audio API untuk membuat sound effects

class SoundEffects {
    private audioContext: AudioContext | null = null;
    private isEnabled: boolean = true;

    constructor() {
        // Initialize AudioContext on first user interaction
        this.initializeAudioContext();
    }

    private initializeAudioContext() {
        try {
            // Only initialize in browser environment
            if (typeof window !== 'undefined') {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            } else {
                this.isEnabled = false;
            }
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
            this.isEnabled = false;
        }
    }

    private async ensureAudioContext() {
        if (!this.audioContext || !this.isEnabled) return null;
        
        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
            } catch (error) {
                console.warn('Failed to resume audio context:', error);
                return null;
            }
        }
        
        return this.audioContext;
    }

    // Modal open sound - drawer opening
    async playModalOpen() {
        const ctx = await this.ensureAudioContext();
        if (!ctx) return;

        try {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            // Drawer opening sound - sliding up frequency
            oscillator.frequency.setValueAtTime(200, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.3);
            
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            
            oscillator.type = 'sine';
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.3);
        } catch (error) {
            console.warn('Failed to play modal open sound:', error);
        }
    }

    // Modal close sound - drawer closing
    async playModalClose() {
        const ctx = await this.ensureAudioContext();
        if (!ctx) return;

        try {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            // Drawer closing sound - sliding down frequency
            oscillator.frequency.setValueAtTime(400, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.25);
            
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
            
            oscillator.type = 'sine';
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.25);
        } catch (error) {
            console.warn('Failed to play modal close sound:', error);
        }
    }

    // Transaction success sound - coin drop
    async playTransactionSuccess() {
        const ctx = await this.ensureAudioContext();
        if (!ctx) return;

        try {
            // Create multiple oscillators for coin-like sound
            const frequencies = [800, 1000, 1200];
            
            frequencies.forEach((freq, index) => {
                setTimeout(() => {
                    const oscillator = ctx.createOscillator();
                    const gainNode = ctx.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(ctx.destination);
                    
                    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 0.2);
                    
                    gainNode.gain.setValueAtTime(0, ctx.currentTime);
                    gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                    
                    oscillator.type = 'sine';
                    oscillator.start(ctx.currentTime);
                    oscillator.stop(ctx.currentTime + 0.2);
                }, index * 50);
            });
        } catch (error) {
            console.warn('Failed to play transaction success sound:', error);
        }
    }

    // Button click sound - subtle click
    async playButtonClick() {
        const ctx = await this.ensureAudioContext();
        if (!ctx) return;

        try {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            oscillator.frequency.setValueAtTime(600, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            
            oscillator.type = 'square';
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.1);
        } catch (error) {
            console.warn('Failed to play button click sound:', error);
        }
    }

    // Error sound - notification
    async playError() {
        const ctx = await this.ensureAudioContext();
        if (!ctx) return;

        try {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            oscillator.frequency.setValueAtTime(300, ctx.currentTime);
            oscillator.frequency.setValueAtTime(250, ctx.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(200, ctx.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.15);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            
            oscillator.type = 'sawtooth';
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.3);
        } catch (error) {
            console.warn('Failed to play error sound:', error);
        }
    }

    // Enable/disable sound effects
    setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
    }

    isAudioEnabled(): boolean {
        return this.isEnabled && this.audioContext !== null;
    }
}

// Create singleton instance
export const soundEffects = new SoundEffects();

// Initialize on first user interaction
let initialized = false;
const initializeOnInteraction = () => {
    if (!initialized) {
        initialized = true;
        soundEffects.playButtonClick(); // Silent initialization
        document.removeEventListener('click', initializeOnInteraction);
        document.removeEventListener('keydown', initializeOnInteraction);
    }
};

// Only add event listeners in browser environment
if (typeof document !== 'undefined') {
    document.addEventListener('click', initializeOnInteraction);
    document.addEventListener('keydown', initializeOnInteraction);
}
