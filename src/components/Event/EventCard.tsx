import { format } from 'date-fns';
import { Event } from '../../types';
import { Modal } from '../Modal';
import { useState } from 'react';
import { CountdownTimer } from '../CountdownTimer';
import { OptimizedImage } from '../OptimizedImage';

export interface EventCardProps {
  event: Event;
  onCheckIn: () => void;
}

export function EventCard({ event, onCheckIn }: EventCardProps) {
  const [showModal, setShowModal] = useState(false);

  const handleCheckIn = () => {
    window.open(event.check_in_form_url, '_blank');
    onCheckIn();
  };

  let dateString = '';
  if (event.date) {
    const dateObj = new Date(event.date);
    if (!isNaN(dateObj.getTime())) {
      dateString = format(dateObj, 'MMMM d, yyyy');
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-gray-900 dark:text-white flex flex-col">
      <OptimizedImage
        src={event.image_url || '/images/events/default.jpg'}
        alt={event.name}
        className="w-full h-40 object-cover rounded-md mb-4"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
      <h3 className="text-lg font-bold mb-2">{event.name}</h3>
      <p className="text-gray-700 dark:text-gray-300 mb-2">{event.description}</p>
      <span className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        {dateString || 'Date TBD'}
      </span>
      <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 self-start mb-2">
        {event.event_type.replace(/_/g, ' ').toUpperCase()}
      </span>
      <CountdownTimer targetDate={new Date(event.date)} />
    </div>
  );
}