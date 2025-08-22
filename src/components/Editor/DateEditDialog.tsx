import { FC, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface DateEditDialogProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onClose: () => void;
}

export const DateEditDialog: FC<DateEditDialogProps> = ({
  currentDate,
  onDateChange,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.showModal();
      
      // Handle clicking outside the dialog
      const handleClick = (e: MouseEvent) => {
        const rect = dialog.getBoundingClientRect();
        const isInDialog = (
          rect.top <= e.clientY &&
          e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX &&
          e.clientX <= rect.left + rect.width
        );
        if (!isInDialog) {
          onClose();
        }
      };

      dialog.addEventListener('click', handleClick);
      
      return () => {
        dialog.removeEventListener('click', handleClick);
        if (dialog.open) {
          dialog.close();
        }
      };
    }
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dateValue = formData.get('date') as string;
    const timeValue = formData.get('time') as string;
    
    if (dateValue && timeValue) {
      const newDate = new Date(`${dateValue}T${timeValue}`);
      onDateChange(newDate);
    }
  };

  // Format current date for input fields
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatTimeForInput = (date: Date) => {
    return date.toTimeString().slice(0, 5);
  };

  return (
    <dialog 
      ref={dialogRef}
      className="date-edit-dialog"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div className="date-edit-content">
        <div className="date-edit-header">
          <h3>Edit Note Date</h3>
          <button 
            type="button" 
            onClick={onClose}
            className="date-edit-close"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="date-edit-form">
          <div className="date-edit-field">
            <label htmlFor="date">Date:</label>
            <input
              type="date"
              id="date"
              name="date"
              defaultValue={formatDateForInput(currentDate)}
              required
            />
          </div>
          
          <div className="date-edit-field">
            <label htmlFor="time">Time:</label>
            <input
              type="time"
              id="time"
              name="time"
              defaultValue={formatTimeForInput(currentDate)}
              required
            />
          </div>
          
          <div className="date-edit-actions">
            <button type="button" onClick={onClose} className="button-secondary">
              Cancel
            </button>
            <button type="submit" className="button-primary">
              Save Date
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};