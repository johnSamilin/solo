import { FC } from 'react';
import { Maximize2, ScanText, Trash2 } from 'lucide-react';

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
  return (
    <div
      className="image-context-menu"
      style={{ left: x, top: y }}
    >
      <button className="menu-item" onClick={onToggleWidth}>
        <Maximize2 className="h-4 w-4" />
        Toggle Full Width
      </button>
      <button className="menu-item" onClick={onRecognizeText}>
        <ScanText className="h-4 w-4" />
        Recognise Text
      </button>
      <button className="menu-item" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
        Delete Image
      </button>
    </div>
  );
};