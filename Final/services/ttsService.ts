/**
 * Text-to-Speech Service
 * Uses Web Speech API (SpeechSynthesis) to speak AI responses
 */

class TTSService {
    private synthesis: SpeechSynthesis;
    private isMuted: boolean = false;
    private currentUtterance: SpeechSynthesisUtterance | null = null;
    private onSpeakStart: (() => void) | null = null;
    private onSpeakEnd: (() => void) | null = null;

    constructor() {
        this.synthesis = window.speechSynthesis;
    }

    /**
     * Set callback for when TTS starts speaking
     */
    setOnSpeakStart(callback: () => void): void {
        this.onSpeakStart = callback;
    }

    /**
     * Set callback for when TTS finishes speaking
     */
    setOnSpeakEnd(callback: () => void): void {
        this.onSpeakEnd = callback;
    }

    /**
     * Speak text aloud
     */
    speak(text: string): void {
        // Don't speak if muted or empty text
        if (this.isMuted || !text || text.trim().length === 0) {
            return;
        }

        // Cancel any ongoing speech
        this.cancel();

        // Create utterance
        this.currentUtterance = new SpeechSynthesisUtterance(text);
        
        // Configure voice settings
        this.currentUtterance.rate = 1.0; // Speed (0.1 to 10)
        this.currentUtterance.pitch = 1.0; // Pitch (0 to 2)
        this.currentUtterance.volume = 1.0; // Volume (0 to 1)
        
        // Try to use a natural English voice
        const voices = this.synthesis.getVoices();
        const englishVoice = voices.find(
            voice => voice.lang.startsWith('en') && voice.name.includes('Natural')
        ) || voices.find(
            voice => voice.lang.startsWith('en-US')
        ) || voices[0];
        
        if (englishVoice) {
            this.currentUtterance.voice = englishVoice;
        }

        // Event listeners
        this.currentUtterance.onstart = () => {
            console.log('🔊 TTS: Started speaking');
            // Notify that TTS started (pause microphone input)
            if (this.onSpeakStart) {
                this.onSpeakStart();
            }
        };

        this.currentUtterance.onend = () => {
            console.log('🔊 TTS: Finished speaking');
            this.currentUtterance = null;
            // Notify that TTS finished (resume microphone input)
            if (this.onSpeakEnd) {
                this.onSpeakEnd();
            }
        };

        this.currentUtterance.onerror = (event) => {
            console.error('🔊 TTS Error:', event.error);
            this.currentUtterance = null;
            // Resume microphone even on error
            if (this.onSpeakEnd) {
                this.onSpeakEnd();
            }
        };

        // Speak!
        this.synthesis.speak(this.currentUtterance);
    }

    /**
     * Cancel current speech
     */
    cancel(): void {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }
        this.currentUtterance = null;
    }

    /**
     * Mute TTS
     */
    mute(): void {
        this.isMuted = true;
        this.cancel();
        console.log('🔇 TTS: Muted');
    }

    /**
     * Unmute TTS
     */
    unmute(): void {
        this.isMuted = false;
        console.log('🔊 TTS: Unmuted');
    }

    /**
     * Toggle mute/unmute
     */
    toggleMute(): boolean {
        if (this.isMuted) {
            this.unmute();
        } else {
            this.mute();
        }
        return this.isMuted;
    }

    /**
     * Check if TTS is currently speaking
     */
    isSpeaking(): boolean {
        return this.synthesis.speaking;
    }

    /**
     * Check if TTS is muted
     */
    getMutedState(): boolean {
        return this.isMuted;
    }

    /**
     * Get available voices
     */
    getVoices(): SpeechSynthesisVoice[] {
        return this.synthesis.getVoices();
    }
}

// Singleton instance
const ttsService = new TTSService();

// Load voices (they may not be immediately available)
if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
        console.log('🔊 TTS: Voices loaded', ttsService.getVoices().length);
    };
}

export default ttsService;

