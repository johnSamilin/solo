import { Database } from 'sqlite3';
import TurndownService from 'turndown';
import { Note, Notebook, Tag } from '../types';
import { generateUniqueId } from '../utils';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
});

interface JoplinNote {
  id: string;
  parent_id: string;
  title: string;
  body: string;
  created_time: number;
  is_todo: number;
}

interface JoplinFolder {
  id: string;
  parent_id: string;
  title: string;
}

interface JoplinTag {
  id: string;
  title: string;
}

interface JoplinNoteTag {
  note_id: string;
  tag_id: string;
}

export async function importFromJoplin(dbPath: string): Promise<{ notes: Note[], notebooks: Notebook[] }> {
  return new Promise((resolve, reject) => {
    const db = new Database(dbPath, (err) => {
      if (err) {
        reject(new Error(`Failed to open Joplin database: ${err.message}`));
        return;
      }
    });

    const notebooks: Notebook[] = [];
    const notes: Note[] = [];
    const tags = new Map<string, Tag>();
    const noteTags = new Map<string, string[]>();

    // First, get all folders (notebooks)
    db.all('SELECT id, parent_id, title FROM folders', [], (err, folders: JoplinFolder[]) => {
      if (err) {
        reject(new Error(`Failed to read folders: ${err.message}`));
        return;
      }

      folders.forEach(folder => {
        notebooks.push({
          id: generateUniqueId(),
          name: folder.title,
          parentId: folder.parent_id || null,
          isExpanded: true
        });
      });

      // Get all tags
      db.all('SELECT id, title FROM tags', [], (err, joplinTags: JoplinTag[]) => {
        if (err) {
          reject(new Error(`Failed to read tags: ${err.message}`));
          return;
        }

        joplinTags.forEach(tag => {
          tags.set(tag.id, {
            id: generateUniqueId(),
            path: tag.title
          });
        });

        // Get note-tag relationships
        db.all('SELECT note_id, tag_id FROM note_tags', [], (err, noteTagRelations: JoplinNoteTag[]) => {
          if (err) {
            reject(new Error(`Failed to read note tags: ${err.message}`));
            return;
          }

          noteTagRelations.forEach(relation => {
            const tagIds = noteTags.get(relation.note_id) || [];
            const tag = tags.get(relation.tag_id);
            if (tag) {
              tagIds.push(tag.id);
              noteTags.set(relation.note_id, tagIds);
            }
          });

          // Finally, get all notes
          db.all(
            'SELECT id, parent_id, title, body, created_time, is_todo FROM notes WHERE is_todo = 0',
            [],
            (err, joplinNotes: JoplinNote[]) => {
              if (err) {
                reject(new Error(`Failed to read notes: ${err.message}`));
                return;
              }

              joplinNotes.forEach(note => {
                const notebookId = notebooks.find(nb => nb.id === note.parent_id)?.id || 'default';
                const noteTagIds = noteTags.get(note.id) || [];
                const noteTags = noteTagIds.map(tagId => {
                  const tag = Array.from(tags.values()).find(t => t.id === tagId);
                  return tag || { id: generateUniqueId(), path: 'imported' };
                });

                notes.push({
                  id: generateUniqueId(),
                  title: note.title,
                  content: turndown.turndown(note.body),
                  createdAt: new Date(note.created_time),
                  notebookId,
                  tags: noteTags
                });
              });

              db.close();
              resolve({ notes, notebooks });
            }
          );
        });
      });
    });
  });
}