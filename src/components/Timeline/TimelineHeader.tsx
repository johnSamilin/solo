import { FC } from 'react';
import { ArrowLeft, Calendar } from 'lucide-react';

interface TimelineHeaderProps {
  onClose: () => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export const TimelineHeader: FC<TimelineHeaderProps> = ({
  onClose,
  selectedDate,
  onDateChange
}) => {
  return (
    <div className="timeline-header">
      <div className="timeline-header-left">
        <button onClick={onClose} className="timeline-back-button">
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <h1>Timeline</h1>
      </div>
      <div className="timeline-date-picker">
        <Calendar className="h-4 w-4" />
        <input
          type="month"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="date-picker-input"
          title="Jump to month"
        />
      </div>
    </div>
  );
};