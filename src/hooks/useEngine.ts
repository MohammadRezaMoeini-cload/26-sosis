import { useLegacyEngine } from './useLegacyEngine';
import { useAudioEngine } from './useAudioEngine';

let _engineLogged = false;
export function useEngine() {
  const legacyAvailable = typeof (window as any).app !== 'undefined' && typeof (window as any).app.EngineFacade === 'function';
  if (!_engineLogged) {
    _engineLogged = true;
    console.info(`[MixMaster] Using ${legacyAvailable ? 'legacy EngineFacade' : 'minimal Web Audio engine'}`);
  }
  return legacyAvailable ? useLegacyEngine() : useAudioEngine();
}
