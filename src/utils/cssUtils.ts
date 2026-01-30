const CUSTOM_STYLES_ID = 'note-custom-styles';

export function injectNoteStyles(css: string, scopeSelector: string): void {
  removeNoteStyles();

  try {
    const styleElement = document.createElement('style');
    styleElement.id = CUSTOM_STYLES_ID;
    styleElement.textContent = `${scopeSelector} { ${css} }`;

    document.head.appendChild(styleElement);
  } catch (error) {
    console.error('Failed to inject custom note styles:', error);
  }
}

export function removeNoteStyles(): void {
  const existingStyle = document.getElementById(CUSTOM_STYLES_ID);
  if (existingStyle) {
    existingStyle.remove();
  }
}
