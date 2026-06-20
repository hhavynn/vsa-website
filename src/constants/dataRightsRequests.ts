import {
  DataRightsRequestPriority,
  DataRightsRequestStatus,
  DataRightsRequestType,
  DataRightsVerificationStatus,
} from '../types/database';

export const DATA_RIGHTS_REQUEST_TYPES: readonly DataRightsRequestType[] = [
  'review',
  'correction',
  'export',
  'deletion',
  'anonymization',
  'media_removal',
  'analytics_browser_help',
  'external_form',
  'other',
];

export const DATA_RIGHTS_REQUEST_STATUSES: readonly DataRightsRequestStatus[] = [
  'intake',
  'identity_verification',
  'preview_needed',
  'pending_review',
  'approved_for_future_action',
  'completed',
  'rejected',
  'cancelled',
];

export const DATA_RIGHTS_VERIFICATION_STATUSES: readonly DataRightsVerificationStatus[] = [
  'not_started',
  'pending',
  'verified',
  'failed',
  'not_required',
];

export const DATA_RIGHTS_REQUEST_PRIORITIES: readonly DataRightsRequestPriority[] = [
  'low',
  'normal',
  'high',
];

export const DATA_RIGHTS_TYPE_LABELS: Record<DataRightsRequestType, string> = {
  review: 'Review',
  correction: 'Correction',
  export: 'Export',
  deletion: 'Deletion',
  anonymization: 'Anonymization',
  media_removal: 'Media removal',
  analytics_browser_help: 'Analytics/browser help',
  external_form: 'External form',
  other: 'Other',
};

export const DATA_RIGHTS_STATUS_LABELS: Record<DataRightsRequestStatus, string> = {
  intake: 'Intake',
  identity_verification: 'Identity verification',
  preview_needed: 'Preview needed',
  pending_review: 'Pending review',
  approved_for_future_action: 'Approved for future action',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const DATA_RIGHTS_VERIFICATION_LABELS: Record<DataRightsVerificationStatus, string> = {
  not_started: 'Not started',
  pending: 'Pending',
  verified: 'Verified',
  failed: 'Failed',
  not_required: 'Not required',
};

export const DATA_RIGHTS_PRIORITY_LABELS: Record<DataRightsRequestPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};
