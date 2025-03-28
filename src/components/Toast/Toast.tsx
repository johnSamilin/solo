import { FC, useEffect } from 'react';
import { X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import './Toast.css';

export const Toast: FC = observer(() => {
  const { settingsStore } = useStore();

  useEffect(() => {
    if (settingsStore.toast) {
      const timer = setTimeout(() => {
        settingsStore.clearToast();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [settingsStore.toast]);

  if (!settingsStore.toast) return null;

  return (
    <div className="toast-container">
      <div className={`toast ${settingsStore.toast.type}`}>
        <span className="toast-message">{settingsStore.toast.message}</span>
        <button
          className="toast-close"
          onClick={() => settingsStore.clearToast()}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});