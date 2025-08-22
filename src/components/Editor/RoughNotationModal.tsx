import { FC, useState } from 'react';
import { X } from 'lucide-react';
import '../Modals/Modals.css';

interface RoughNotationModalProps {
  onClose: () => void;
  onApply: (type: string, color: string) => void;
}

const notationTypes = [
  { value: 'underline', label: 'Underline', description: 'Simple underline annotation' },
  { value: 'box', label: 'Box', description: 'Rectangle around text' },
  { value: 'circle', label: 'Circle', description: 'Circular annotation around text' },
  { value: 'highlight', label: 'Highlight', description: 'Background highlight' },
  { value: 'strike-through', label: 'Strike Through', description: 'Line through text' },
  { value: 'crossed-off', label: 'Crossed Off', description: 'Multiple lines through text' },
];

const colors = [
  { value: '#ff6b6b', label: 'Red', color: '#ff6b6b' },
  { value: '#4ecdc4', label: 'Teal', color: '#4ecdc4' },
  { value: '#45b7d1', label: 'Blue', color: '#45b7d1' },
  { value: '#96ceb4', label: 'Green', color: '#96ceb4' },
  { value: '#feca57', label: 'Yellow', color: '#feca57' },
  { value: '#ff9ff3', label: 'Pink', color: '#ff9ff3' },
  { value: '#54a0ff', label: 'Light Blue', color: '#54a0ff' },
  { value: '#5f27cd', label: 'Purple', color: '#5f27cd' },
];

export const RoughNotationModal: FC<RoughNotationModalProps> = ({
  onClose,
  onApply,
}) => {
  const [selectedType, setSelectedType] = useState('underline');
  const [selectedColor, setSelectedColor] = useState('#ff6b6b');

  const handleApply = () => {
    onApply(selectedType, selectedColor);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Add Rough Notation</h2>
          <button className="button-icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="modal-content">
          <div className="settings-group">
            <h3>Annotation Type</h3>
            <div className="notation-types">
              {notationTypes.map((type) => (
                <label key={type.value} className="notation-type-option">
                  <input
                    type="radio"
                    name="notationType"
                    value={type.value}
                    checked={selectedType === type.value}
                    onChange={(e) => setSelectedType(e.target.value)}
                  />
                  <div className="notation-type-info">
                    <span className="notation-type-label">{type.label}</span>
                    <span className="notation-type-description">{type.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="settings-group">
            <h3>Color</h3>
            <div className="color-palette">
              {colors.map((color) => (
                <button
                  key={color.value}
                  className={`color-option ${selectedColor === color.value ? 'selected' : ''}`}
                  style={{ backgroundColor: color.color }}
                  onClick={() => setSelectedColor(color.value)}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="settings-group">
            <h3>Preview</h3>
            <div className="notation-preview">
              <span 
                className="preview-text"
                style={{ 
                  position: 'relative',
                  display: 'inline-block',
                  padding: '4px 8px',
                }}
              >
                Sample text with {selectedType} annotation
              </span>
            </div>
          </div>

          <div className="modal-actions">
            <button onClick={onClose} className="button-secondary">
              Cancel
            </button>
            <button onClick={handleApply} className="button-primary">
              Apply Notation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};