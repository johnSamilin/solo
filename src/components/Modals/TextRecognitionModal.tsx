import { FC, useState } from 'react';
import { X, Copy, Loader2, Languages } from 'lucide-react';
import { analytics } from '../../utils/analytics';
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
  const [selectedLanguage, setSelectedLanguage] = useState<string>('eng+rus');
  const [progress, setProgress] = useState<string>('');

  const languageOptions = [
    { value: 'eng+rus', label: 'English + Russian (Auto)' },
    { value: 'eng', label: 'English' },
    { value: 'rus', label: 'Russian' },
    { value: 'eng+deu', label: 'English + German' },
    { value: 'eng+fra', label: 'English + French' },
    { value: 'eng+spa', label: 'English + Spanish' },
  ];

  const recognizeText = async () => {
    setIsProcessing(true);
    setError('');
    setHasStarted(true);
    setProgress('Initializing...');
    analytics.ocrUsed();
    
    try {
      // Dynamic import to reduce bundle size
      const Tesseract = await import('tesseract.js');
      
      const { data: { text } } = await Tesseract.recognize(
        imageUrl,
        selectedLanguage,
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              const progressPercent = Math.round(m.progress * 100);
              setProgress(`Recognizing text... ${progressPercent}%`);
            } else if (m.status === 'loading tesseract core') {
              setProgress('Loading OCR engine...');
            } else if (m.status === 'initializing tesseract') {
              setProgress('Initializing OCR...');
            } else if (m.status === 'loading language traineddata') {
              setProgress('Loading language data...');
            } else if (m.status === 'initializing api') {
              setProgress('Preparing recognition...');
            }
          }
        }
      );
      
      setRecognizedText(text.trim());
      analytics.ocrCompleted(true);
    } catch (err) {
      console.error('OCR Error:', err);
      setError('Failed to recognize text from image. Please try again or try a different language.');
      analytics.ocrCompleted(false);
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(recognizedText);
      analytics.textCopied();
      // Show success feedback
      const button = document.activeElement as HTMLButtonElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>Copy to Clipboard';
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to copy text:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = recognizedText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      analytics.textCopied();
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
            <>
              <div className="setting-item">
                <label>
                  <Languages className="h-4 w-4" style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Recognition Language
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="language-select"
                >
                  {languageOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button
                  onClick={recognizeText}
                  className="button-primary"
                  disabled={isProcessing}
                >
                  Start Recognition
                </button>
              </div>
            </>
          )}

          {isProcessing && (
            <div className="ocr-status">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{progress}</span>
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