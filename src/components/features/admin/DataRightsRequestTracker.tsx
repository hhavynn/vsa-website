import { zodResolver } from '@hookform/resolvers/zod';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { UseFormRegisterReturn, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import {
  DATA_RIGHTS_PRIORITY_LABELS,
  DATA_RIGHTS_REQUEST_PRIORITIES,
  DATA_RIGHTS_REQUEST_STATUSES,
  DATA_RIGHTS_REQUEST_TYPES,
  DATA_RIGHTS_STATUS_LABELS,
  DATA_RIGHTS_TYPE_LABELS,
  DATA_RIGHTS_VERIFICATION_LABELS,
  DATA_RIGHTS_VERIFICATION_STATUSES,
} from '../../../constants/dataRightsRequests';
import {
  DataRightsRequest,
  DataRightsRequestInput,
  dataRightsRequestsRepository,
} from '../../../data/repos/dataRightsRequests';
import {
  DataRightsRequestFormData,
  DataRightsRequestFormSchema,
} from '../../../schemas';
import { DataRightsRequestStatus, DataRightsRequestType } from '../../../types/database';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input, Textarea } from '../../ui/Input';

const selectClassName =
  'w-full rounded border border-border-strong bg-surface px-3 py-[9px] text-sm text-text-primary outline-none transition-colors focus:border-brand-600 focus:ring-1 focus:ring-brand-600 dark:focus:border-brand-400 dark:focus:ring-brand-400';

const emptyForm: DataRightsRequestFormData = {
  request_type: 'review',
  status: 'intake',
  subject_auth_user_id: '',
  subject_member_id: '',
  subject_display_name: '',
  contact_channel: '',
  contact_reference: '',
  verification_status: 'not_started',
  verification_method: '',
  assigned_to: '',
  reviewer_id: '',
  priority: 'normal',
  summary: '',
  internal_notes: '',
  decision: '',
};

function requestToForm(request: DataRightsRequest): DataRightsRequestFormData {
  return {
    request_type: request.request_type,
    status: request.status,
    subject_auth_user_id: request.subject_auth_user_id ?? '',
    subject_member_id: request.subject_member_id ?? '',
    subject_display_name: request.subject_display_name ?? '',
    contact_channel: request.contact_channel ?? '',
    contact_reference: request.contact_reference ?? '',
    verification_status: request.verification_status,
    verification_method: request.verification_method ?? '',
    assigned_to: request.assigned_to ?? '',
    reviewer_id: request.reviewer_id ?? '',
    priority: request.priority,
    summary: request.summary ?? '',
    internal_notes: request.internal_notes ?? '',
    decision: request.decision ?? '',
  };
}

function formToInput(values: DataRightsRequestFormData): DataRightsRequestInput {
  return {
    request_type: values.request_type,
    status: values.status,
    subject_auth_user_id: values.subject_auth_user_id || null,
    subject_member_id: values.subject_member_id || null,
    subject_display_name: values.subject_display_name,
    contact_channel: values.contact_channel,
    contact_reference: values.contact_reference,
    verification_status: values.verification_status,
    verification_method: values.verification_method,
    assigned_to: values.assigned_to || null,
    reviewer_id: values.reviewer_id || null,
    priority: values.priority,
    summary: values.summary,
    internal_notes: values.internal_notes,
    decision: values.decision,
  };
}

function formatTimestamp(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function requestLabel(request: DataRightsRequest): string {
  return request.subject_display_name?.trim() || `Request ${request.id.slice(0, 8)}`;
}

export function DataRightsRequestTracker() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | DataRightsRequestStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | DataRightsRequestType>('all');
  const [saveError, setSaveError] = useState<string | null>(null);

  const requestsQuery = useQuery(
    ['admin', 'data-rights-requests'],
    () => dataRightsRequestsRepository.listDataRightsRequests(),
    { staleTime: 30_000, refetchOnWindowFocus: false },
  );
  const adminsQuery = useQuery(
    ['admin', 'data-rights-assignees'],
    () => dataRightsRequestsRepository.listAdminAssignees(),
    { staleTime: 5 * 60_000, refetchOnWindowFocus: false },
  );
  const eventsQuery = useQuery(
    ['admin', 'data-rights-request-events', editingId],
    () => dataRightsRequestsRepository.listDataRightsRequestEvents(editingId as string),
    { enabled: editingId !== null, refetchOnWindowFocus: false },
  );

  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);
  const selectedRequest = requests.find((request) => request.id === editingId) ?? null;
  const filteredRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          (statusFilter === 'all' || request.status === statusFilter) &&
          (typeFilter === 'all' || request.request_type === typeFilter),
      ),
    [requests, statusFilter, typeFilter],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DataRightsRequestFormData>({
    resolver: zodResolver(DataRightsRequestFormSchema),
    defaultValues: emptyForm,
  });

  useEffect(() => {
    reset(selectedRequest ? requestToForm(selectedRequest) : emptyForm);
    setSaveError(null);
  }, [reset, selectedRequest]);

  const saveMutation = useMutation(
    ({ id, input }: { id: string | null; input: DataRightsRequestInput }) =>
      id
        ? dataRightsRequestsRepository.updateDataRightsRequest(id, input)
        : dataRightsRequestsRepository.createDataRightsRequest(input),
    {
      onSuccess: async (request) => {
        setEditingId(request.id);
        setSaveError(null);
        await Promise.all([
          queryClient.invalidateQueries(['admin', 'data-rights-requests']),
          queryClient.invalidateQueries(['admin', 'data-rights-request-events', request.id]),
        ]);
        toast.success(editingId ? 'Request updated' : 'Request created');
      },
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to save request';
        setSaveError(message);
        toast.error('Unable to save request');
      },
    },
  );

  function startNewRequest() {
    setEditingId(null);
    reset(emptyForm);
    setSaveError(null);
  }

  const onSubmit = handleSubmit((values) => {
    setSaveError(null);
    saveMutation.mutate({ id: editingId, input: formToInput(values) });
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
            Admin operations
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Data Rights
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
            Track minimal intake, verification, review, and decision metadata for privacy and data requests.
          </p>
        </div>
        <Button type="button" onClick={startNewRequest}>New request</Button>
      </div>

      <section
        aria-labelledby="tracker-safety-heading"
        className="mb-6 rounded border border-border-strong bg-surface2 px-4 py-4"
      >
        <h2 id="tracker-safety-heading" className="text-sm font-semibold text-text-primary">
          Intake and review only
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-text-secondary">
          This tracker does not export, delete, anonymize, or remove data. Use it to document verification status, review decisions, and future approved actions. Follow <code>docs/privacy-data-rights-architecture.md</code>.
        </p>
      </section>

      {(requestsQuery.isError || adminsQuery.isError) && (
        <div role="alert" className="mb-6 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          The tracker could not load. Confirm the migration is applied and your account still has admin access.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <section aria-labelledby="request-list-heading">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="request-list-heading" className="text-lg font-semibold text-text-primary">Requests</h2>
              <p className="mt-1 text-xs text-text-muted">{filteredRequests.length} shown · {requests.length} total</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-medium text-text-secondary">
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | DataRightsRequestStatus)}
                  className={`${selectClassName} mt-1`}
                >
                  <option value="all">All statuses</option>
                  {DATA_RIGHTS_REQUEST_STATUSES.map((status) => (
                    <option key={status} value={status}>{DATA_RIGHTS_STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-text-secondary">
                Type
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as 'all' | DataRightsRequestType)}
                  className={`${selectClassName} mt-1`}
                >
                  <option value="all">All types</option>
                  {DATA_RIGHTS_REQUEST_TYPES.map((type) => (
                    <option key={type} value={type}>{DATA_RIGHTS_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <Card padding={0} className="overflow-hidden">
            {requestsQuery.isLoading ? (
              <p className="px-4 py-12 text-center text-sm text-text-muted">Loading requests…</p>
            ) : filteredRequests.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-text-muted">No requests match these filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b border-border-strong bg-surface2">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold text-text-secondary">Subject</th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold text-text-secondary">Type</th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold text-text-secondary">Status</th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold text-text-secondary">Verification</th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold text-text-secondary">Updated</th>
                      <th scope="col" className="px-4 py-3"><span className="sr-only">Edit</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-strong">
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className={request.id === editingId ? 'bg-surface2' : 'bg-surface'}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-text-primary">{requestLabel(request)}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-text-muted">{request.id.slice(0, 8)}</p>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">{DATA_RIGHTS_TYPE_LABELS[request.request_type]}</td>
                        <td className="px-4 py-3 text-text-secondary">{DATA_RIGHTS_STATUS_LABELS[request.status]}</td>
                        <td className="px-4 py-3 text-text-secondary">{DATA_RIGHTS_VERIFICATION_LABELS[request.verification_status]}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-text-muted">{formatTimestamp(request.updated_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(request.id)}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>

        <section aria-labelledby="request-form-heading">
          <Card>
            <div className="mb-5">
              <h2 id="request-form-heading" className="text-lg font-semibold text-text-primary">
                {selectedRequest ? `Review ${requestLabel(selectedRequest)}` : 'Record a new request'}
              </h2>
              <p id="minimal-data-help" className="mt-1 text-xs leading-5 text-text-muted">
                Keep entries brief. Do not paste full conversations, identity documents, contact details, check-in codes, payment information, private rosters, export payloads, or private links.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5" aria-describedby="minimal-data-help">
              {saveError && (
                <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                  {saveError}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelect label="Request type" id="request_type" error={errors.request_type?.message} register={register('request_type')}>
                  {DATA_RIGHTS_REQUEST_TYPES.map((type) => (
                    <option key={type} value={type}>{DATA_RIGHTS_TYPE_LABELS[type]}</option>
                  ))}
                </FormSelect>
                <FormSelect label="Status" id="status" error={errors.status?.message} register={register('status')}>
                  {DATA_RIGHTS_REQUEST_STATUSES.map((status) => (
                    <option key={status} value={status}>{DATA_RIGHTS_STATUS_LABELS[status]}</option>
                  ))}
                </FormSelect>
                <FormSelect label="Verification" id="verification_status" error={errors.verification_status?.message} register={register('verification_status')}>
                  {DATA_RIGHTS_VERIFICATION_STATUSES.map((status) => (
                    <option key={status} value={status}>{DATA_RIGHTS_VERIFICATION_LABELS[status]}</option>
                  ))}
                </FormSelect>
                <FormSelect label="Priority" id="priority" error={errors.priority?.message} register={register('priority')}>
                  {DATA_RIGHTS_REQUEST_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>{DATA_RIGHTS_PRIORITY_LABELS[priority]}</option>
                  ))}
                </FormSelect>
              </div>

              <FormInput label="Subject display name" id="subject_display_name" error={errors.subject_display_name?.message} inputProps={register('subject_display_name')} placeholder="Minimal name or approved label" />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput label="Contact channel" id="contact_channel" error={errors.contact_channel?.message} inputProps={register('contact_channel')} placeholder="e.g. official email inbox" />
                <FormInput label="Opaque contact reference" id="contact_reference" error={errors.contact_reference?.message} inputProps={register('contact_reference')} placeholder="Ticket/reference ID only" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput label="Confirmed Auth user ID" id="subject_auth_user_id" error={errors.subject_auth_user_id?.message} inputProps={register('subject_auth_user_id')} placeholder="Optional UUID" />
                <FormInput label="Confirmed member ID" id="subject_member_id" error={errors.subject_member_id?.message} inputProps={register('subject_member_id')} placeholder="Optional UUID" />
              </div>

              <FormInput label="Verification method" id="verification_method" error={errors.verification_method?.message} inputProps={register('verification_method')} placeholder="Brief method/result; no document copies" />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelect label="Assigned to" id="assigned_to" error={errors.assigned_to?.message} register={register('assigned_to')}>
                  <option value="">Unassigned</option>
                  {(adminsQuery.data ?? []).map((admin) => (
                    <option key={admin.id} value={admin.id}>{admin.displayName}</option>
                  ))}
                </FormSelect>
                <FormSelect label="Independent reviewer" id="reviewer_id" error={errors.reviewer_id?.message} register={register('reviewer_id')}>
                  <option value="">Not assigned</option>
                  {(adminsQuery.data ?? []).map((admin) => (
                    <option key={admin.id} value={admin.id}>{admin.displayName}</option>
                  ))}
                </FormSelect>
              </div>

              <FormTextarea label="Brief summary" id="summary" error={errors.summary?.message} textareaProps={register('summary')} maxLength={1000} />
              <FormTextarea label="Brief internal review notes" id="internal_notes" error={errors.internal_notes?.message} textareaProps={register('internal_notes')} maxLength={2000} />
              <FormTextarea label="Decision or future action" id="decision" error={errors.decision?.message} textareaProps={register('decision')} maxLength={1000} />

              {selectedRequest && (
                <dl className="grid gap-3 rounded border border-border-strong bg-surface2 p-3 text-xs sm:grid-cols-3">
                  <div><dt className="font-medium text-text-muted">Created</dt><dd className="mt-1 text-text-secondary">{formatTimestamp(selectedRequest.created_at)}</dd></div>
                  <div><dt className="font-medium text-text-muted">Updated</dt><dd className="mt-1 text-text-secondary">{formatTimestamp(selectedRequest.updated_at)}</dd></div>
                  <div><dt className="font-medium text-text-muted">Completed</dt><dd className="mt-1 text-text-secondary">{formatTimestamp(selectedRequest.completed_at)}</dd></div>
                </dl>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" loading={saveMutation.isLoading}>
                  {selectedRequest ? 'Save review record' : 'Create request record'}
                </Button>
                {selectedRequest && <Button type="button" variant="outline" onClick={startNewRequest}>Cancel editing</Button>}
              </div>
            </form>
          </Card>

          {selectedRequest && (
            <Card className="mt-4">
              <h2 className="text-sm font-semibold text-text-primary">Audit history</h2>
              <p className="mt-1 text-xs text-text-muted">Append-only metadata events; note contents are never copied here.</p>
              {eventsQuery.isLoading ? (
                <p className="mt-4 text-sm text-text-muted">Loading history…</p>
              ) : eventsQuery.isError ? (
                <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">History could not be loaded.</p>
              ) : (eventsQuery.data ?? []).length === 0 ? (
                <p className="mt-4 text-sm text-text-muted">No history events yet.</p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {(eventsQuery.data ?? []).map((event) => (
                    <li key={event.id} className="border-l-2 border-border-strong pl-3">
                      <p className="text-sm text-text-primary">{event.event_summary}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{formatTimestamp(event.created_at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

interface FormInputProps {
  label: string;
  id: string;
  error?: string;
  inputProps: UseFormRegisterReturn;
  placeholder?: string;
}

function FormInput({ label, id, error, inputProps, placeholder }: FormInputProps) {
  return (
    <label htmlFor={id} className="block text-xs font-medium text-text-secondary">
      {label}
      <Input id={id} {...inputProps} placeholder={placeholder} className="mt-1" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
      {error && <span id={`${id}-error`} role="alert" className="mt-1 block text-xs text-red-700 dark:text-red-300">{error}</span>}
    </label>
  );
}

interface FormSelectProps {
  label: string;
  id: string;
  error?: string;
  register: UseFormRegisterReturn;
  children: ReactNode;
}

function FormSelect({ label, id, error, register, children }: FormSelectProps) {
  return (
    <label htmlFor={id} className="block text-xs font-medium text-text-secondary">
      {label}
      <select id={id} {...register} className={`${selectClassName} mt-1`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>
        {children}
      </select>
      {error && <span id={`${id}-error`} role="alert" className="mt-1 block text-xs text-red-700 dark:text-red-300">{error}</span>}
    </label>
  );
}

interface FormTextareaProps {
  label: string;
  id: string;
  error?: string;
  textareaProps: UseFormRegisterReturn;
  maxLength: number;
}

function FormTextarea({ label, id, error, textareaProps, maxLength }: FormTextareaProps) {
  return (
    <label htmlFor={id} className="block text-xs font-medium text-text-secondary">
      {label}
      <Textarea id={id} {...textareaProps} rows={3} maxLength={maxLength} className="mt-1" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : 'minimal-data-help'} />
      {error && <span id={`${id}-error`} role="alert" className="mt-1 block text-xs text-red-700 dark:text-red-300">{error}</span>}
    </label>
  );
}
