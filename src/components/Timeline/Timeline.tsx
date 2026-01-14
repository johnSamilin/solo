import { FC, useState, useEffect, useRef, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import { Note } from '../../types';
import { TimelineHeader } from './TimelineHeader';
import { TimelineItem } from './TimelineItem';
import './Timeline.css';

interface TimelinePageProps {
  onClose: () => void;
  onNoteSelect: (note: Note) => void;
}

interface TimelineItemData {
  type: 'year' | 'month' | 'current';
  date: Date;
  label: string;
  notes: Note[];
  isLeft: boolean;
  position: number;
}

export const Timeline: FC<TimelinePageProps> = observer(({ onClose, onNoteSelect }) => {
  const { notesStore, settingsStore } = useStore();
  const [timelineItems, setTimelineItems] = useState<TimelineItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Generate timeline items
  const generateTimelineItems = useCallback(() => {
    const now = new Date();
    const items: TimelineItemData[] = [];
    
    const timelineTags = ['Main events', 'Главные события'];
    const visibleNotes = notesStore.getVisibleNotes()
      .filter(note => {
        const hasTimelineTag = note.tags.some(tag =>
          timelineTags.some(timelineTag => tag.includes(timelineTag))
        );

        if (hasTimelineTag) return true;
        
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
    
    const notesByDate = new Map<string, Note[]>();
    visibleNotes.forEach(note => {
      const date = new Date(note.createdAt);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!notesByDate.has(yearMonth)) {
        notesByDate.set(yearMonth, []);
      }
      notesByDate.get(yearMonth)!.push(note);
    });

    const startYear = now.getFullYear() - 5;
    const endYear = now.getFullYear() + 5;
    
    let currentPosition = 0;
    
    for (let year = startYear; year <= endYear; year++) {
      items.push({
        type: 'year',
        date: new Date(year, 0, 1),
        label: year.toString(),
        notes: [],
        isLeft: false,
        position: currentPosition
      });
      currentPosition += 80;
      
      for (let month = 0; month < 12; month++) {
        const monthDate = new Date(year, month, 1);
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        const monthNotes = notesByDate.get(monthKey) || [];
        
        const isCurrent = year === now.getFullYear() && month === now.getMonth();
        
        items.push({
          type: isCurrent ? 'current' : 'month',
          date: monthDate,
          label: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          notes: monthNotes,
          isLeft: ((year - startYear) * 12 + month) % 2 === 0,
          position: currentPosition
        });
        currentPosition += 120;
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

    setTimeout(() => {
      const currentItem = items.find(item => item.type === 'current');
      if (currentItem && containerRef.current) {
        const scrollPosition = currentItem.position - window.innerHeight / 2;
        containerRef.current.scrollTop = Math.max(0, scrollPosition);
      }
    }, 100);
  }, [generateTimelineItems]);

  // Handle infinite scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    
    const buffer = 1200;
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
      handleScroll();
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handleNoteClick = async (note: Note) => {
    if (!note.content) {
      await notesStore.loadNoteContent(note);
    }
    onNoteSelect(note);
  };

  const handleDateChange = (dateString: string) => {
    setSelectedDate(dateString);
    
    if (!dateString || !containerRef.current) return;
    
    const selectedDate = new Date(dateString);
    const targetYear = selectedDate.getFullYear();
    const targetMonth = selectedDate.getMonth();
    
    const targetItem = timelineItems.find(item => {
      if (item.type !== 'month' && item.type !== 'current') return false;
      return item.date.getFullYear() === targetYear && item.date.getMonth() === targetMonth;
    });
    
    if (targetItem) {
      const scrollPosition = targetItem.position - 200;
      containerRef.current.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
    }
  };

  const visibleItems = timelineItems.slice(visibleRange.start, visibleRange.end);

  return (
    <div className="timeline-page">
      <TimelineHeader
        onClose={onClose}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
      />

      <div className="timeline-container" ref={containerRef}>
        {isLoading ? (
          <div className="timeline-loading">
            <div className="timeline-loading-spinner"></div>
            <span>Loading timeline...</span>
          </div>
        ) : (
          <div className="timeline-content">
            <div className="timeline-line"></div>
            
            {visibleItems.map((item) => (
              <TimelineItem
                key={`${item.date.getTime()}-${item.type}`}
                item={item}
                onNoteClick={handleNoteClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});