import { PageTitle } from '../../components/common/PageTitle';
import PhotoRequestsTab from '../../components/features/admin/PhotoRequestsTab';

export default function AdminPhotoRequests() {
  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Photo Requests" />

      <div className="border-b" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>Photo Requests</h1>
        <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text2)' }}>
          Review member profile photo submissions. Approved photos are published as small public thumbnails; pending photos stay private.
        </p>
      </div>

      <div style={{ padding: '24px 28px' }}>
        <PhotoRequestsTab />
      </div>
    </div>
  );
}
