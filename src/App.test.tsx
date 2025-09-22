import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders VSA website', () => {
  render(<App />);
  // Check if the app renders without crashing
  expect(document.body).toBeInTheDocument();
});
