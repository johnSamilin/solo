import { FC, useState } from 'react';
import { X, Copy, Loader2 } from 'lucide-react';
import './Modals.css';

interface TextRecognitionModalProps {
  onClose: () => void;
  imageUrl: string;
}

export const TextRecognitionModal: FC<TextRecognitionModalProps> = ({
  onClose,
  imageUrl,
}) => {
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasStarted, setHasStarted] = useState(false);

  const recognizeText = async () => {
    setIsProcessing(true);
    setError('');
    setHasStarted(true);
    
    try {
      // Dynamic import to reduce bundle size
      const Tesseract = await import('tesseract.js');
      
      const { data: { text } } = await Tesseract.recognize(
        imageUrl,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              // Optional: could show progress here
            }
          }
        }
      );
      
      setRecognizedText(text.trim());
    } catch (err) {
      console.error('OCR Error:', err);
      setError('Failed to recognize text from image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(recognizedText);
      // Could show a toast here, but keeping it simple
    } catch (err) {
      console.error('Failed to copy text:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = recognizedText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Text Recognition</h2>
          <button className="button-icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="modal-content">
          <div className="ocr-preview">
            <img 
              src={imageUrl} 
              alt="Image for text recognition" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '200px', 
                objectFit: 'contain',
                border: '1px solid var(--color-border)',
                borderRadius: '0.5rem'
              }} 
            />
          </div>
          
          {!hasStarted && (
            <div className="modal-actions">
              <button
                onClick={recognizeText}
                className="button-primary"
                disabled={isProcessing}
              >
                Start Recognition
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="ocr-status">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Recognizing text...</span>
            </div>
          )}

          {error && (
            <div className="import-status error">
              {error}
            </div>
          )}

          {recognizedText && (
            <div className="ocr-result">
              <label>Recognized Text:</label>
              <textarea
                value={recognizedText}
                onChange={(e) => setRecognizedText(e.target.value)}
                className="ocr-textarea"
                rows={8}
                placeholder="Recognized text will appear here..."
              />
              <div className="modal-actions">
                <button
                  onClick={copyToClipboard}
                  className="button-primary"
                >
                  <Copy className="h-4 w-4" />
                  Copy to Clipboard
                </button>
                <button
                  onClick={recognizeText}
                  className="button-primary"
                  disabled={isProcessing}
                >
                  Recognize Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};