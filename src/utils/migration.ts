import { db } from './database';
import { isPlugin } from '../config';

const MIGRATION_KEY = 'solo-migration-completed';
const TAG_MIGRATION_KEY = 'solo-tag-migration-completed';
const OLD_STORAGE_KEY = 'solo-notes-data';

interface LegacyData {
  notes: any[];
  notebooks: any[];
  selectedNoteId: string | null;
  focusedNotebookId: string | null;
}

interface LegacyTag {
  id: string;
  path: string;
}

export class MigrationManager {
  async checkAndMigrate(): Promise<boolean> {
    // Check if migration already completed
    const migrationCompleted = await this.isMigrationCompleted();
    if (migrationCompleted) {
      return true;
    }

    // Check if there's legacy data to migrate
    const legacyData = await this.getLegacyData();
    if (!legacyData || (!legacyData.notes?.length && !legacyData.notebooks?.length)) {
      // No legacy data, mark migration as completed
      await this.markMigrationCompleted();
      return true;
    }

    // Show migration confirmation dialog
    const shouldMigrate = await this.showMigrationDialog(legacyData);
    if (!shouldMigrate) {
      // User declined migration, mark as completed to avoid showing again
      await this.markMigrationCompleted();
      return false;
    }

    // Perform migration
    try {
      await this.performMigration(legacyData);
      await this.markMigrationCompleted();
      await this.cleanupLegacyData();
      return true;
    } catch (error) {
      console.error('Migration failed:', error);
      throw new Error(`Migration failed: ${error}`);
    }
  }

  private async isMigrationCompleted(): Promise<boolean> {
    try {
      if (isPlugin) {
        const result = await window.bridge?.loadFromStorage(MIGRATION_KEY);
        return !!result;
      } else {
        return !!localStorage.getItem(MIGRATION_KEY);
      }
    } catch {
      return false;
    }
  }

  private async markMigrationCompleted(): Promise<void> {
    try {
      if (isPlugin) {
        await window.bridge?.saveToStorage(MIGRATION_KEY, true);
      } else {
        localStorage.setItem(MIGRATION_KEY, 'true');
      }
    } catch (error) {
      console.error('Failed to mark migration as completed:', error);
    }
  }

  private async getLegacyData(): Promise<LegacyData | null> {
    try {
      if (isPlugin) {
        let data = await window.bridge?.loadFromStorage(OLD_STORAGE_KEY);
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        return data;
      } else {
        const stored = localStorage.getItem(OLD_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
      }
    } catch (error) {
      console.error('Failed to load legacy data:', error);
      return null;
    }
  }

  private async showMigrationDialog(legacyData: LegacyData): Promise<boolean> {
    const noteCount = legacyData.notes?.length || 0;
    const notebookCount = legacyData.notebooks?.length || 0;

    const message = `
🔄 **Database Migration Required**

We've found your existing data:
• ${noteCount} notes
• ${notebookCount} notebooks

To improve performance and storage efficiency, Solo now uses a modern database system (IndexedDB).

**Benefits:**
✅ Faster loading and searching
✅ Better memory usage
✅ More reliable data storage
✅ Improved sync performance

**What happens:**
• Your existing data will be safely migrated
• All notes and notebooks will be preserved
• Settings and preferences will be maintained
• The old storage will be cleaned up

Would you like to migrate your data now?

**Note:** This is a one-time process and cannot be undone.
    `.trim();

    return confirm(message);
  }

  private async performMigration(legacyData: LegacyData): Promise<void> {
    // Initialize database
    await db.initialize();

    // Import data to IndexedDB
    await db.importData({
      notes: legacyData.notes || [],
      notebooks: legacyData.notebooks || []
    });

    // Migrate other settings
    if (legacyData.selectedNoteId) {
      await db.saveSetting('selectedNoteId', legacyData.selectedNoteId);
    }
    if (legacyData.focusedNotebookId) {
      await db.saveSetting('focusedNotebookId', legacyData.focusedNotebookId);
    }
  }

  private async cleanupLegacyData(): Promise<void> {
    try {
      if (isPlugin) {
        // Note: We don't actually delete the legacy data in plugin mode
        // in case the user wants to rollback. The bridge should handle cleanup.
        console.log('Legacy data cleanup handled by bridge');
      } else {
        localStorage.removeItem(OLD_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to cleanup legacy data:', error);
    }
  }

  async forceMigration(): Promise<void> {
    // Remove migration flag and retry
    if (isPlugin) {
      await window.bridge?.saveToStorage(MIGRATION_KEY, null);
    } else {
      localStorage.removeItem(MIGRATION_KEY);
    }
    await this.checkAndMigrate();
  }

  async migrateTagsToStrings(): Promise<boolean> {
    try {
      // Check if migration already completed
      const migrationCompleted = localStorage.getItem(TAG_MIGRATION_KEY);
      if (migrationCompleted === 'true') {
        return true;
      }

      console.log('Starting tag migration from objects to strings...');

      // Migrate notes in IndexedDB if exists
      try {
        await db.initialize();
        const notes = await db.getAllNotes();

        for (const note of notes) {
          let needsUpdate = false;
          const parsedTags = JSON.parse(note.tags);

          // Check if tags are in old format (array of objects with id and path)
          if (Array.isArray(parsedTags) && parsedTags.length > 0 &&
              typeof parsedTags[0] === 'object' && 'path' in parsedTags[0]) {
            console.log(`Migrating tags for note ${note.id}`);

            // Convert from Tag[] to string[]
            const migratedTags = parsedTags.map((tag: LegacyTag) => tag.path);
            note.tags = JSON.stringify(migratedTags);
            needsUpdate = true;
          }

          if (needsUpdate) {
            await db.saveNote(note);
          }
        }

        console.log('Tag migration completed successfully');
      } catch (error) {
        console.log('No IndexedDB data to migrate or error occurred:', error);
      }

      // Mark migration as completed
      localStorage.setItem(TAG_MIGRATION_KEY, 'true');
      return true;
    } catch (error) {
      console.error('Tag migration failed:', error);
      return false;
    }
  }
}

export const migrationManager = new MigrationManager();