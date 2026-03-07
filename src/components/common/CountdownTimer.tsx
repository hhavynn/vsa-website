import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  targetDate: Date;
  onComplete?: () => void;
}

export function CountdownTimer({ targetDate, onComplete }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isComplete: false
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime();
      
      if (difference <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isComplete: true
        });
        onComplete?.();
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({
        days,
        hours,
        minutes,
        seconds,
        isComplete: false
      });
    };

    // Calculate immediately
    calculateTimeLeft();

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);

    // Cleanup
    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  if (timeLeft.isComplete) {
    return (
      <div className="text-red-400 text-sm font-medium">
        Event has started!
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      {timeLeft.days > 0 && (
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-indigo-400">{timeLeft.days}</span>
          <span className="text-xs text-gray-400">days</span>
        </div>
      )}
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold text-indigo-400">{timeLeft.hours.toString().padStart(2, '0')}</span>
        <span className="text-xs text-gray-400">hours</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold text-indigo-400">{timeLeft.minutes.toString().padStart(2, '0')}</span>
        <span className="text-xs text-gray-400">min</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold text-indigo-400">{timeLeft.seconds.toString().padStart(2, '0')}</span>
        <span className="text-xs text-gray-400">sec</span>
      </div>
    </div>
  );
} 