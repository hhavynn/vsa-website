import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

test('renders VSA website', async () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );

  expect(await screen.findAllByText(/VSA at UCSD/i)).not.toHaveLength(0);
});
