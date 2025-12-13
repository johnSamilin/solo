import { Sequelize, DataTypes, Model } from 'sequelize';
import * as path from 'path';
import { app } from 'electron';

interface NoteAttributes {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  notebookId: string;
  theme?: string;
  tags: string;
}

interface NotebookAttributes {
  id: string;
  name: string;
  parentId: string | null;
  isExpanded: boolean;
}

interface SettingAttributes {
  key: string;
  value: string;
}

class Note extends Model<NoteAttributes> implements NoteAttributes {
  public id!: string;
  public title!: string;
  public content!: string;
  public createdAt!: string;
  public notebookId!: string;
  public theme?: string;
  public tags!: string;
}

class Notebook extends Model<NotebookAttributes> implements NotebookAttributes {
  public id!: string;
  public name!: string;
  public parentId!: string | null;
  public isExpanded!: boolean;
}

class Setting extends Model<SettingAttributes> implements SettingAttributes {
  public key!: string;
  public value!: string;
}

class DatabaseManager {
  private sequelize: Sequelize | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'solo.db');

      this.sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: false,
      });

      this.initializeModels();
      await this.sequelize.sync();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Sequelize database:', error);
      throw error;
    }
  }

  private initializeModels(): void {
    if (!this.sequelize) throw new Error('Sequelize not initialized');

    Note.init(
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        title: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        notebookId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        theme: {
          type: DataTypes.STRING,
        },
        tags: {
          type: DataTypes.TEXT,
          defaultValue: '[]',
        },
      },
      {
        sequelize: this.sequelize,
        tableName: 'notes',
        timestamps: false,
      }
    );

    Notebook.init(
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        parentId: {
          type: DataTypes.STRING,
        },
        isExpanded: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
      },
      {
        sequelize: this.sequelize,
        tableName: 'notebooks',
        timestamps: false,
      }
    );

    Setting.init(
      {
        key: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        value: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
      },
      {
        sequelize: this.sequelize,
        tableName: 'settings',
        timestamps: false,
      }
    );
  }

  async getAllNotes(): Promise<NoteAttributes[]> {
    const notes = await Note.findAll({
      order: [['createdAt', 'DESC']],
    });
    return notes.map((n) => n.toJSON());
  }

  async getNote(id: string): Promise<NoteAttributes | null> {
    const note = await Note.findByPk(id);
    return note ? note.toJSON() : null;
  }

  async saveNote(note: NoteAttributes): Promise<void> {
    await Note.upsert(note);
  }

  async deleteNote(id: string): Promise<void> {
    await Note.destroy({ where: { id } });
  }

  async getNotesByNotebook(notebookId: string): Promise<NoteAttributes[]> {
    const notes = await Note.findAll({
      where: { notebookId },
      order: [['createdAt', 'DESC']],
    });
    return notes.map((n) => n.toJSON());
  }

  async getAllNotebooks(): Promise<NotebookAttributes[]> {
    const notebooks = await Notebook.findAll();
    return notebooks.map((n) => n.toJSON());
  }

  async saveNotebook(notebook: NotebookAttributes): Promise<void> {
    await Notebook.upsert(notebook);
  }

  async deleteNotebook(id: string): Promise<void> {
    await Notebook.destroy({ where: { id } });
  }

  async getSetting(key: string): Promise<any> {
    const setting = await Setting.findByPk(key);
    if (!setting) return null;
    return JSON.parse(setting.value);
  }

  async saveSetting(key: string, value: any): Promise<void> {
    await Setting.upsert({ key, value: JSON.stringify(value) });
  }

  async importData(data: { notes: any[]; notebooks: any[] }): Promise<void> {
    for (const note of data.notes) {
      await this.saveNote({
        id: note.id,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt,
        notebookId: note.notebookId,
        theme: note.theme,
        tags: typeof note.tags === 'string' ? note.tags : JSON.stringify(note.tags || []),
      });
    }

    for (const notebook of data.notebooks) {
      await this.saveNotebook({
        id: notebook.id,
        name: notebook.name,
        parentId: notebook.parentId || null,
        isExpanded: notebook.isExpanded || false,
      });
    }
  }
}

export const electronDb = new DatabaseManager();
