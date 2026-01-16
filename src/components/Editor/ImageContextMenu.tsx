import { FC } from 'react';
import { Maximize2, ScanText, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

interface ImageContextMenuProps {
  x: number;
  y: number;
  onToggleWidth: () => void;
  onRecognizeText: () => void;
  onDelete: () => void;
}

export const ImageContextMenu: FC<ImageContextMenuProps> = ({
  x,
  y,
  onToggleWidth,
  onRecognizeText,
  onDelete
}) => {
  const { t } = useI18n();

  return (
    <div
      className="image-context-menu"
      style={{ left: x, top: y }}
    >
      <button className="menu-item" onClick={onToggleWidth}>
        <Maximize2 className="h-4 w-4" />
        {t.imageModal.toggleFullWidth}
      </button>
      <button className="menu-item" onClick={onRecognizeText}>
        <ScanText className="h-4 w-4" />
        {t.imageModal.recognizeText}
      </button>
      <button className="menu-item" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
        {t.imageModal.deleteImage}
      </button>
    </div>
  );
};