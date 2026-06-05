import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

let audioCtx: AudioContext | null = null;

const unlockAudio = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    // Play a silent oscillator to force unlock on strict browsers (iOS Safari, Chrome)
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(0);
    osc.stop(audioCtx.currentTime + 0.001);

    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  } catch (e) {}
};

if (typeof window !== 'undefined') {
  window.addEventListener('click', unlockAudio);
  window.addEventListener('touchstart', unlockAudio);
}

export const triggerBassAudio = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // Triangle wave for richer harmonics that small speakers can reproduce
    oscillator.type = 'triangle';
    
    // 808-style pitch drop: Starts at 150Hz to get a "click", then dives to 40Hz
    oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); 
    oscillator.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);

    // Envelope to make it sound like a heavy physical "thump"
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.01); // Instant attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4); // Fade out

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.warn("Web Audio API not supported or failed", e);
  }
};

export const triggerNativeVibration = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      setTimeout(async () => {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      }, 150);
      setTimeout(async () => {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      }, 300);
    } catch (e) {
      console.warn("Capacitor Haptics failed", e);
    }
  } else if (typeof navigator.vibrate === 'function') {
    // Fallback for Android Chrome browser test
    navigator.vibrate([150, 100, 150, 100, 150]);
  }
};

export const triggerScreenShake = () => {
  const body = document.body;
  body.classList.remove('animate-screen-shake');
  void body.offsetWidth; // Trigger DOM reflow to restart animation
  body.classList.add('animate-screen-shake');
  setTimeout(() => {
    body.classList.remove('animate-screen-shake');
  }, 500);
};

export const triggerPrankVibration = async () => {
  if (Capacitor.isNativePlatform()) {
    // True mobile native app -> use physical vibration
    await triggerNativeVibration();
  } else {
    // Mobile browser -> use navigator.vibrate
    // PC browser -> use Bass Audio + Screen Shake
    const isMobileBrowser = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobileBrowser && typeof navigator.vibrate === 'function') {
      await triggerNativeVibration();
    } else {
      triggerBassAudio();
      triggerScreenShake();
    }
  }
};

export const triggerHeartbeatVibration = async (timeRemaining: number) => {
  // Cap the scale between 1 and 10
  const clampedTime = Math.max(1, Math.min(10, timeRemaining));
  const intensityProgress = 10 - clampedTime; // 0 (at 10s) to 9 (at 1s)

  if (Capacitor.isNativePlatform()) {
    try {
      let style = ImpactStyle.Light;
      if (clampedTime <= 3) style = ImpactStyle.Heavy;
      else if (clampedTime <= 6) style = ImpactStyle.Medium;
      
      await Haptics.impact({ style });
    } catch (e) {}
  } else if (typeof navigator.vibrate === 'function') {
    // Scales from 30ms to ~165ms
    navigator.vibrate(30 + intensityProgress * 15);
  } else {
    // For PC, scale the bass tick volume and depth
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      // Use triangle wave because pure sine waves are invisible to tiny laptop speakers
      osc.type = 'triangle';
      
      // Pitch drop (808 kick style): Starts higher so small speakers catch the "click", then drops deep
      const startFreq = 120 + intensityProgress * 5; // 120Hz to 165Hz
      const endFreq = 40;
      
      osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + 0.1);
      
      // Volume scales from 0.4 to 1.0
      const peakGain = Math.min(1.0, 0.4 + intensityProgress * 0.06);
      
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(peakGain, audioCtx.currentTime + 0.01); // Instant attack
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15); // Fast decay
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
  }
};
