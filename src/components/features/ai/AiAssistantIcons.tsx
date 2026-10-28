export function ChatSparkIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.5 7.25A4.25 4.25 0 0 1 9.75 3h4.5a4.25 4.25 0 0 1 4.25 4.25v4.1a4.25 4.25 0 0 1-4.25 4.25h-3.8l-4.1 3.15a.7.7 0 0 1-1.12-.56V15.1a4.23 4.23 0 0 1-1.48-3.2V7.25Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M17.8 3.25l.52 1.2 1.18.52-1.18.52-.52 1.18-.52-1.18-1.2-.52 1.2-.52.52-1.2ZM9.1 8.15h5.2M9.1 11.1h3.65"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}


export function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m5.25 5.25 9.5 9.5M14.75 5.25l-9.5 9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

