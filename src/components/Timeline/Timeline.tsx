import { FC, useState, useEffect, useRef, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { ArrowLeft } from 'lucide-react';
import { useStore } from '../../stores/StoreProvider';
import { Note } from '../../types';
import './Timeline.css';

interface TimelinePageProps {
  onClose: () => void;
  onNoteSelect: (note: Note) => void;
}

interface TimelineItem {
  type: 'year' | 'month' | 'current';
  date: Date;
  label: string;
  notes: Note[];
  isLeft: boolean;
  position: number;
}

export const Timeline: FC<TimelinePageProps> = observer(({ onClose, onNoteSelect }) => {
  const { notesStore, settingsStore } = useStore();
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  // Generate timeline items
  const generateTimelineItems = useCallback(() => {
    const now = new Date();
    const items: TimelineItem[] = [];
    
    // Filter notes that have special timeline tags or paragraphs with timeline tags
    const timelineTags = ['Main events', 'Главные события'];
    const visibleNotes = notesStore.getVisibleNotes(settingsStore.isCensorshipEnabled())
      .filter(note => {
        // Check note-level tags
        const hasTimelineTag = note.tags.some(tag => 
          timelineTags.some(timelineTag => tag.path.includes(timelineTag))
        );
        
        if (hasTimelineTag) return true;
        
        // Check paragraph-level tags
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.content;
        const taggedElements = tempDiv.querySelectorAll('[data-tags]');
        
        for (const element of taggedElements) {
          const tags = element.getAttribute('data-tags') || '';
          const paragraphTags = tags.split(',').map(tag => tag.trim());
          
          if (paragraphTags.some(tag => 
            timelineTags.some(timelineTag => tag.includes(timelineTag))
          )) {
            return true;
          }
        }
        
        return false;
      });
    
    // Group notes by year and month
    const notesByDate = new Map<string, Note[]>();
    visibleNotes.forEach(note => {
      const date = new Date(note.createdAt);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!notesByDate.has(yearMonth)) {
        notesByDate.set(yearMonth, []);
      }
      notesByDate.get(yearMonth)!.push(note);
    });

    // Generate timeline with months only at even intervals
    const startYear = now.getFullYear() - 5;
    const endYear = now.getFullYear() + 5;
    
    const totalYears = endYear - startYear + 1;
    const totalMonths = totalYears * 12;
    
    let currentPosition = 0;
    
    for (let year = startYear; year <= endYear; year++) {
      // Add year separator (decorative only)
      items.push({
        type: 'year',
        date: new Date(year, 0, 1),
        label: year.toString(),
        notes: [],
        isLeft: false,
        position: currentPosition
      });
      currentPosition += 80; // Space for year separator
      
      // Add months at even intervals
      for (let month = 0; month < 12; month++) {
        const monthDate = new Date(year, month, 1);
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        const monthNotes = notesByDate.get(monthKey) || [];
        
        // Check if this is the current month
        const isCurrent = year === now.getFullYear() && month === now.getMonth();
        
        items.push({
          type: isCurrent ? 'current' : 'month',
          date: monthDate,
          label: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          notes: monthNotes,
          isLeft: ((year - startYear) * 12 + month) % 2 === 0,
          position: currentPosition
        });
        currentPosition += 120; // Space for each month
      }
    }

    return items;
  }, [notesStore, settingsStore]);

  // Initialize timeline
  useEffect(() => {
    setIsLoading(true);
    const items = generateTimelineItems();
    setTimelineItems(items);
    setIsLoading(false);

    // Scroll to current date
    setTimeout(() => {
      const currentItem = items.find(item => item.type === 'current');
      if (currentItem && containerRef.current) {
        const scrollPosition = currentItem.position - window.innerHeight / 2;
        containerRef.current.scrollTop = Math.max(0, scrollPosition);
      }
    }, 100);
  }, [generateTimelineItems]);

  // Handle infinite scroll (virtual scrolling for performance)
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    
    // Find visible items based on their positions
    const buffer = 1200; // 10 items * 120px
    const visibleItems = timelineItems.filter(item => 
      item.position >= scrollTop - buffer && 
      item.position <= scrollTop + containerHeight + buffer
    );
    
    const startIndex = timelineItems.findIndex(item => visibleItems.includes(item));
    const endIndex = startIndex + visibleItems.length;
    
    setVisibleRange({ 
      start: Math.max(0, startIndex), 
      end: Math.min(timelineItems.length, endIndex) 
    });
  }, [timelineItems]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial call
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handleNoteClick = async (note: Note) => {
    // Load note content if not already loaded
    if (!note.content) {
      await notesStore.loadNoteContent(note);
    }
    onNoteSelect(note);
  };

  const getPreviewText = (note: Note): string => {
    if (!note.content) return 'No content';
    
    // Remove HTML tags and get plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.content;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    // Return first 100 characters
    return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText;
  };

  const visibleItems = timelineItems.slice(visibleRange.start, visibleRange.end);

  return (
    <div className="timeline-page">
      <div className="timeline-header">
        <button onClick={onClose} className="timeline-back-button">
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <h1>Timeline</h1>
      </div>

      <div className="timeline-container" ref={containerRef}>
        {isLoading ? (
          <div className="timeline-loading">
            <div className="timeline-loading-spinner"></div>
            <span>Loading timeline...</span>
          </div>
        ) : (
          <div className="timeline-content">
            <div className="timeline-line"></div>
            
            {visibleItems.map((item, index) => {
              return (
                <div
                  key={`${item.date.getTime()}-${item.type}`}
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
                                onClick={() => handleNoteClick(note)}
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
                                onClick={() => handleNoteClick(note)}
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
            })}
          </div>
        )}
      </div>
    </div>
  );
});