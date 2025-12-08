import { TagNode } from '../types';

interface DigikamTag {
  id: number;
  pid: number;
  name: string;
}

interface DigikamPhoto {
  id: number;
  name: string;
  album: string;
  relativePath: string;
  specificPath: string;
}

export async function queryDigikamTags(dbPath: string): Promise<TagNode[]> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }

  const query = `
    SELECT id, pid, name
    FROM Tags
    ORDER BY pid, name
  `;

  const result = await window.electronAPI.queryDigikam(dbPath, query);

  if (!result.success) {
    throw new Error(result.error || 'Failed to query digiKam tags');
  }

  const tags: DigikamTag[] = result.rows || [];

  return buildTagTree(tags);
}

function buildTagTree(tags: DigikamTag[]): TagNode[] {
  const tagMap = new Map<number, TagNode>();
  const rootTags: TagNode[] = [];

  tags.forEach(tag => {
    tagMap.set(tag.id, {
      id: tag.id.toString(),
      name: tag.name,
      children: [],
      isChecked: false,
      isExpanded: false,
    });
  });

  tags.forEach(tag => {
    const node = tagMap.get(tag.id);
    if (!node) return;

    if (tag.pid === 0) {
      rootTags.push(node);
    } else {
      const parent = tagMap.get(tag.pid);
      if (parent) {
        parent.children.push(node);
      }
    }
  });

  return rootTags;
}

export async function queryDigikamPhotos(dbPath: string, tagId: string): Promise<string[]> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }

  const query = `
    SELECT DISTINCT
      Images.id,
      Images.name,
      Albums.albumRoot,
      Albums.relativePath,
      Albums.specificPath
    FROM Images
    INNER JOIN ImageTags ON Images.id = ImageTags.imageid
    INNER JOIN Albums ON Images.album = Albums.id
    WHERE ImageTags.tagid = ?
    ORDER BY Images.modificationDate DESC
    LIMIT 10
  `;

  const result = await window.electronAPI.queryDigikam(dbPath, query, [parseInt(tagId)]);

  if (!result.success) {
    throw new Error(result.error || 'Failed to query digiKam photos');
  }

  const photos: any[] = result.rows || [];

  const albumRootsQuery = `SELECT id, specificPath FROM AlbumRoots`;
  const albumRootsResult = await window.electronAPI.queryDigikam(dbPath, albumRootsQuery);

  if (!albumRootsResult.success) {
    throw new Error(albumRootsResult.error || 'Failed to query album roots');
  }

  const albumRootsMap = new Map<number, string>();
  (albumRootsResult.rows || []).forEach((row: any) => {
    albumRootsMap.set(row.id, row.specificPath);
  });

  const photoPaths = photos.map(photo => {
    const rootPath = albumRootsMap.get(photo.albumRoot) || '';
    const relativePath = photo.relativePath || '';
    const fileName = photo.name;

    let fullPath = rootPath;
    if (relativePath && relativePath !== '/') {
      fullPath += relativePath;
    }
    if (!fullPath.endsWith('/')) {
      fullPath += '/';
    }
    fullPath += fileName;

    return fullPath;
  });

  return photoPaths;
}
