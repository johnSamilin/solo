import { FC } from 'react';
import { Note } from '../../types';

interface TimelineItemData {
  type: 'year' | 'month' | 'current';
  date: Date;
  label: string;
  notes: Note[];
  isLeft: boolean;
  position: number;
}

interface TimelineItemProps {
  item: TimelineItemData;
  onNoteClick: (note: Note) => void;
}

export const TimelineItem: FC<TimelineItemProps> = ({ item, onNoteClick }) => {
  const getPreviewText = (note: Note): string => {
    if (!note.content) return 'No content';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.content;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText;
  };

  return (
    <div
      className={`timeline-item ${item.type}`}
      style={{ 
        position: 'absolute',
        top: `${item.position}px`,
        left: 0,
        right: 0
      }}
    >
      <div className={`timeline-marker ${item.type}`}></div>
      
      {item.isLeft ? (
        <>
          <div className="timeline-content-left">
            <div className={`timeline-date ${item.type}`}>
              {item.label}
            </div>
            {item.notes.length > 0 ? (
              <div className="timeline-notes">
                {item.notes.slice(0, 3).map(note => (
                  <div
                    key={note.id}
                    className="timeline-note"
                    onClick={() => onNoteClick(note)}
                  >
                    <div className="timeline-note-title">
                      {note.title}
                    </div>
                    <div className="timeline-note-preview">
                      {getPreviewText(note)}
                    </div>
                  </div>
                ))}
                {item.notes.length > 3 && (
                  <div className="timeline-empty">
                    +{item.notes.length - 3} more notes
                  </div>
                )}
              </div>
            ) : item.type !== 'year' ? (
              <div className="timeline-empty">No notes</div>
            ) : null}
          </div>
          <div className="timeline-content-right"></div>
        </>
      ) : (
        <>
          <div className="timeline-content-left"></div>
          <div className="timeline-content-right">
            <div className={`timeline-date ${item.type}`}>
              {item.label}
            </div>
            {item.notes.length > 0 ? (
              <div className="timeline-notes">
                {item.notes.slice(0, 3).map(note => (
                  <div
                    key={note.id}
                    className="timeline-note"
                    onClick={() => onNoteClick(note)}
                  >
                    <div className="timeline-note-title">
                      {note.title}
                    </div>
                    <div className="timeline-note-preview">
                      {getPreviewText(note)}
                    </div>
                  </div>
                ))}
                {item.notes.length > 3 && (
                  <div className="timeline-empty">
                    +{item.notes.length - 3} more notes
                  </div>
                )}
              </div>
            ) : item.type !== 'year' ? (
              <div className="timeline-empty">No notes</div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};