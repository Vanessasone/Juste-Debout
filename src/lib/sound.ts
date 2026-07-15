/**
 * Effets sonores de l'écran LIVE (suspense + révélation).
 * Basé sur expo-audio. Tolérant aux erreurs : si l'audio n'est pas dispo, silencieux.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let suspensePlayer: AudioPlayer | null = null;
let revealPlayer: AudioPlayer | null = null;
let modeSet = false;

async function ensureMode() {
  if (modeSet) return;
  modeSet = true;
  try {
    // Joue même si le téléphone est en mode silencieux (broadcast).
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    /* ignore */
  }
}

function play(which: 'suspense' | 'reveal') {
  try {
    ensureMode();
    if (which === 'suspense') {
      if (!suspensePlayer) suspensePlayer = createAudioPlayer(require('@/assets/sounds/suspense.wav'));
      suspensePlayer.seekTo(0);
      suspensePlayer.play();
    } else {
      if (!revealPlayer) revealPlayer = createAudioPlayer(require('@/assets/sounds/reveal.wav'));
      revealPlayer.seekTo(0);
      revealPlayer.play();
    }
  } catch {
    /* audio indisponible — on n'interrompt jamais la révélation visuelle */
  }
}

export function playSuspense() {
  play('suspense');
}

export function playReveal() {
  play('reveal');
}

export function stopSuspense() {
  try {
    suspensePlayer?.pause();
  } catch {
    /* ignore */
  }
}
