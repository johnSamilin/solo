import { FC, useState } from 'react';
import { X, Copy, Loader2, Languages, Settings } from 'lucide-react';
import './Modals.css';

interface TextRecognitionModalProps {
  onClose: () => void;
  imageUrl: string;
}

type RecognitionService = 'google-vision' | 'azure-vision';

export const TextRecognitionModal: FC<TextRecognitionModalProps> = ({
  onClose,
  imageUrl,
}) => {
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasStarted, setHasStarted] = useState(false);
  const [selectedService, setSelectedService] = useState<RecognitionService>('google-vision');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [progress, setProgress] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);

  const serviceOptions = [
    { 
      value: 'google-vision', 
      label: 'Google Cloud Vision API',
      description: 'Best-in-class handwriting recognition with excellent accuracy for both printed and handwritten text'
    },
    { 
      value: 'azure-vision', 
      label: 'Azure Computer Vision API',
      description: 'Professional handwriting recognition with strong multilingual support'
    },
  ];

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'ru', label: 'Russian (Cyrillic)' },
    { value: 'de', label: 'German' },
    { value: 'fr', label: 'French' },
    { value: 'es', label: 'Spanish' },
    { value: 'it', label: 'Italian' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'ar', label: 'Arabic' },
    { value: 'hi', label: 'Hindi' },
  ];

  const recognizeWithGoogleVision = async (imageDataUrl: string) => {
    if (!apiKey) {
      throw new Error('Google Cloud Vision API key is required');
    }

    setProgress('Converting image...');
    
    // Convert image to base64
    const base64Data = imageDataUrl.split(',')[1];
    
    setProgress('Sending to Google Cloud Vision...');
    
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Data,
            },
            features: [
              {
                type: 'DOCUMENT_TEXT_DETECTION',
                maxResults: 1,
              },
            ],
            imageContext: {
              languageHints: [selectedLanguage],
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Google Vision API request failed');
    }

    const data = await response.json();
    
    if (data.responses[0].error) {
      throw new Error(data.responses[0].error.message);
    }

    const textAnnotation = data.responses[0].fullTextAnnotation;
    if (!textAnnotation) {
      throw new Error('No text detected in the image');
    }

    return textAnnotation.text;
  };

  const recognizeWithAzureVision = async (imageDataUrl: string) => {
    if (!apiKey) {
      throw new Error('Azure Computer Vision API key is required');
    }

    setProgress('Converting image...');
    
    // Convert data URL to blob
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    
    setProgress('Sending to Azure Computer Vision...');
    
    // Note: You'll need to replace this with your Azure endpoint
    const azureEndpoint = 'https://your-resource-name.cognitiveservices.azure.com';
    
    const azureResponse = await fetch(`${azureEndpoint}/vision/v3.2/read/analyze`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: blob,
    });

    if (!azureResponse.ok) {
      throw new Error('Azure Vision API request failed');
    }

    const operationLocation = azureResponse.headers.get('Operation-Location');
    if (!operationLocation) {
      throw new Error('No operation location returned from Azure');
    }

    // Poll for results
    setProgress('Processing with Azure...');
    let result;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const resultResponse = await fetch(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
        },
      });

      result = await resultResponse.json();
      
      if (result.status === 'succeeded') {
        break;
      } else if (result.status === 'failed') {
        throw new Error('Azure text recognition failed');
      }
      
      attempts++;
      setProgress(`Processing with Azure... (${attempts}/${maxAttempts})`);
    }

    if (result.status !== 'succeeded') {
      throw new Error('Azure text recognition timed out');
    }

    // Extract text from Azure response
    const pages = result.analyzeResult?.readResults || [];
    const extractedText = pages
      .flatMap((page: any) => page.lines || [])
      .map((line: any) => line.text)
      .join('\n');

    if (!extractedText) {
      throw new Error('No text detected in the image');
    }

    return extractedText;
  };

  const convertImageToDataUrl = async (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const recognizeText = async () => {
    setIsProcessing(true);
    setError('');
    setHasStarted(true);
    setProgress('Initializing...');
    
    try {
      let text = '';
      const imageDataUrl = await convertImageToDataUrl(imageUrl);
      
      if (selectedService === 'google-vision') {
        text = await recognizeWithGoogleVision(imageDataUrl);
      } else if (selectedService === 'azure-vision') {
        text = await recognizeWithAzureVision(imageDataUrl);
      }
      
      setRecognizedText(text);
    } catch (err) {
      console.error('OCR Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to recognize text from image. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(recognizedText);
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
    }
  };

  const selectedServiceInfo = serviceOptions.find(s => s.value === selectedService);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Handwriting Recognition</h2>
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
                <label>Recognition Service</label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value as RecognitionService)}
                  className="language-select"
                >
                  {serviceOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedServiceInfo && (
                <div className="import-status" style={{ backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #7dd3fc' }}>
                  {selectedServiceInfo.description}
                </div>
              )}

              <div className="setting-item">
                <label>API Key</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Enter ${selectedService === 'google-vision' ? 'Google Cloud Vision' : 'Azure Computer Vision'} API key`}
                    className="language-select"
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="button-icon"
                    title="API Setup Instructions"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {showSettings && selectedService === 'google-vision' && (
                <div className="import-status" style={{ backgroundColor: '#fefce8', color: '#a16207', border: '1px solid #fde047' }}>
                  <strong>Google Cloud Vision Setup:</strong><br />
                  1. Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a><br />
                  2. Enable the Vision API<br />
                  3. Create an API key in Credentials<br />
                  4. Paste the API key above<br />
                  <em>Free tier: 1,000 requests/month</em>
                </div>
              )}

              {showSettings && selectedService === 'azure-vision' && (
                <div className="import-status" style={{ backgroundColor: '#fefce8', color: '#a16207', border: '1px solid #fde047' }}>
                  <strong>Azure Computer Vision Setup:</strong><br />
                  1. Go to <a href="https://portal.azure.com/" target="_blank" rel="noopener noreferrer">Azure Portal</a><br />
                  2. Create a Computer Vision resource<br />
                  3. Copy the API key from Keys and Endpoint<br />
                  4. Update the endpoint URL in the code<br />
                  5. Paste the API key above<br />
                  <em>Free tier: 5,000 requests/month</em>
                </div>
              )}

              <div className="setting-item">
                <label>
                  <Languages className="h-4 w-4" style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Language
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
                  disabled={isProcessing || !apiKey}
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
                  onClick={() => {
                    setHasStarted(false);
                    setRecognizedText('');
                    setError('');
                  }}
                  className="button-primary"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};