export type DigikamLibrary = 'solo' | '9x15';

/** Keep notes independent of the Android device's absolute photo-folder path. */
export function digikamImageRef(library: DigikamLibrary, path: string): string {
  const segments = path.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || /[\\\0]/.test(segment))) {
    throw new Error('Invalid digiKam image path');
  }
  return `digikam://${library}/${segments.map(encodeURIComponent).join('/')}`;
}
