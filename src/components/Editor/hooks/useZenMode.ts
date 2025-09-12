import { useEffect } from 'react';
import { useStore } from '../../../stores/StoreProvider';

export const useZenMode = () => {
  const { settingsStore } = useStore();

  useEffect(() => {
    const handleFullscreen = async () => {
      try {
        if (settingsStore.isZenMode) {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          }
        } else if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (error) {
        // Silently handle fullscreen errors
      }
    };

    handleFullscreen();

    function onFSChange() {
      try {
        if (!document.fullscreenElement) {
          settingsStore.turnZenModeOff();
        }
      } catch (error) {
        // Silently handle fullscreen errors
      }
    }

    document.addEventListener('fullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
    };
  }, [settingsStore.isZenMode]);
};