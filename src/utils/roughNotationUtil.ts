import { annotate, RoughAnnotation } from 'rough-notation';

// Store active annotations to manage cleanup
const activeAnnotations = new Map<Element, RoughAnnotation>();

// Throttle function to prevent excessive calls
let isThrottled = false;
const THROTTLE_DELAY = 200;

export const applyRoughNotations = () => {
  if (isThrottled) return;
  
  isThrottled = true;
  setTimeout(() => {
    isThrottled = false;
  }, THROTTLE_DELAY);

  // Find all elements with rough notation attributes
  const elements = document.querySelectorAll('[data-notation-type][data-notation-color]');
  
  // Keep track of current elements
  const currentElements = new Set<Element>();
  
  elements.forEach(element => {
    currentElements.add(element);
    
    // Skip if already annotated
    if (activeAnnotations.has(element)) {
      return;
    }
    
    const type = element.getAttribute('data-notation-type');
    const color = element.getAttribute('data-notation-color');
    
    if (!type || !color) return;
    
    // Check if element is visible
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    try {
      const annotation = annotate(element as HTMLElement, {
        type: type as any,
        color: color,
        strokeWidth: 2,
        padding: 4,
        animationDuration: 0, // No animation to prevent flicker
        iterations: 1,
      });
      
      annotation.show();
      activeAnnotations.set(element, annotation);
    } catch (error) {
      console.warn('Failed to create rough notation:', error);
    }
  });
  
  // Clean up annotations for elements that no longer exist
  for (const [element, annotation] of activeAnnotations.entries()) {
    if (!currentElements.has(element)) {
      try {
        annotation.remove();
      } catch (error) {
        console.warn('Failed to remove rough notation:', error);
      }
      activeAnnotations.delete(element);
    }
  }
};

export const clearAllRoughNotations = () => {
  for (const [element, annotation] of activeAnnotations.entries()) {
    try {
      annotation.remove();
    } catch (error) {
      console.warn('Failed to remove rough notation:', error);
    }
  }
  activeAnnotations.clear();
};

// Debounced version for typing events
let typingTimeout: NodeJS.Timeout | null = null;
export const applyRoughNotationsAfterTyping = () => {
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }
  
  typingTimeout = setTimeout(() => {
    applyRoughNotations();
  }, 1000); // 1 second after stopping typing
};