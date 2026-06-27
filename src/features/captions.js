// Live captions via the Web Speech API (SpeechRecognition).
//
// PRIVACY CAVEAT (must be disclosed in the UI): unlike the rest of SoundScope,
// the Web Speech API may stream audio to a cloud service for recognition
// (e.g. Chrome sends audio to Google). This is the one feature that is not
// fully on-device. It also requires a network connection in most browsers.

export class CaptionEngine {
  constructor({ onResult, onState, onError } = {}) {
    this.onResult = onResult;
    this.onState = onState;
    this.onError = onError;
    this.recognition = null;
    this.running = false;
    this.lang = 'en-US';
  }

  static isSupported() {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  start() {
    if (!CaptionEngine.isSupported()) {
      this.onError?.('Live captions are not supported in this browser. Try Chrome on desktop or Android.');
      return;
    }
    if (this.running) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      this.onResult?.({ interim, final });
    };
    rec.onerror = (e) => {
      this.onError?.(captionErrorMessage(e.error));
    };
    rec.onend = () => {
      // Auto-restart while the user still wants captions (engines time out).
      if (this.running) {
        try {
          rec.start();
        } catch {
          /* will retry on next end */
        }
      } else {
        this.onState?.(false);
      }
    };

    this.recognition = rec;
    this.running = true;
    try {
      rec.start();
      this.onState?.(true);
    } catch (err) {
      this.running = false;
      this.onError?.(`Could not start captions: ${err?.message || err}`);
    }
  }

  setLang(lang) {
    this.lang = lang;
    if (this.recognition) this.recognition.lang = lang;
  }

  stop() {
    this.running = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        /* ignore */
      }
    }
    this.onState?.(false);
  }
}

function captionErrorMessage(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission for captions was denied.';
    case 'no-speech':
      return 'No speech detected — still listening…';
    case 'network':
      return 'Captions need a network connection (audio is sent to a cloud recognizer).';
    case 'audio-capture':
      return 'No microphone available for captions.';
    default:
      return `Caption error: ${code}`;
  }
}
