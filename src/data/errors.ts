import { PostgrestError } from '@supabase/supabase-js';

export interface ApiError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export class DatabaseError extends Error {
  public readonly code?: string;
  public readonly details?: string;
  public readonly hint?: string;

  constructor(message: string, code?: string, details?: string, hint?: string) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
}

export class ValidationError extends Error {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error occurred') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class NotFoundError extends Error {
  public readonly resource?: string;
  public readonly id?: string;

  constructor(message: string = 'Resource not found', resource?: string, id?: string) {
    super(message);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.id = id;
  }
}

/**
 * Normalizes Supabase errors into standardized error types
 */
export function normalizeSupabaseError(error: PostgrestError): DatabaseError {
  const { message, code, details, hint } = error;
  
  // Map common PostgreSQL error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    '23505': 'This record already exists',
    '23503': 'Referenced record does not exist',
    '23502': 'Required field is missing',
    '42501': 'Insufficient permissions',
    '42P01': 'Table does not exist',
    'PGRST116': 'No rows found',
    'PGRST301': 'JWT expired',
    'PGRST302': 'JWT invalid',
  };

  const friendlyMessage = errorMessages[code] || message || 'Database error occurred';
  
  return new DatabaseError(friendlyMessage, code, details, hint);
}

/**
 * Wraps async operations with standardized error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DatabaseError || error instanceof ValidationError) {
      throw error;
    }

    if (error instanceof Error) {
      // Check if it's a Supabase error
      if ('code' in error && 'details' in error) {
        throw normalizeSupabaseError(error as PostgrestError);
      }

      // Network errors
      if (error.message.includes('fetch') || error.message.includes('network')) {
        throw new NetworkError(error.message);
      }

      // Generic error wrapping
      throw new Error(context ? `${context}: ${error.message}` : error.message);
    }

    throw new Error(context ? `${context}: Unknown error occurred` : 'Unknown error occurred');
  }
}

/**
 * Type guard to check if an error is a known error type
 */
export function isKnownError(error: unknown): error is DatabaseError | ValidationError | AuthenticationError | AuthorizationError | NetworkError | NotFoundError {
  return error instanceof DatabaseError ||
         error instanceof ValidationError ||
         error instanceof AuthenticationError ||
         error instanceof AuthorizationError ||
         error instanceof NetworkError ||
         error instanceof NotFoundError;
}
