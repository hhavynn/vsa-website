import { PageTitle } from '../../components/common/PageTitle';
import { AdminPageHeader } from '../../components/features/admin/AdminPageHeader';
import PhotoRequestsTab from '../../components/features/admin/PhotoRequestsTab';

export default function AdminPhotoRequests() {
  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Photo Requests" />

      <AdminPageHeader
        title="Photo Requests"
        description="Review member profile photo submissions. Approved photos are published as small public thumbnails; pending photos stay private."
      />

      <div className="px-5 py-6 sm:px-8">
        <PhotoRequestsTab />
      </div>
    </div>
  );
}
