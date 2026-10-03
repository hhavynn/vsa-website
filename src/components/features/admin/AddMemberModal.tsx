import toast from "react-hot-toast";
import {
  adminMembersRepository,
  AdminMemberSummary,
} from "../../../data/repos/adminMembers";
import { ValidationError } from "../../../data/errors";
import { AdminMemberSchema } from "../../../schemas";
import { useAdminForm } from "../../../hooks/useAdminForm";
import { OFFICIAL_YEARS } from "../../../lib/yearNormalizer";
import { MEMBER_COLLEGES } from "../../../constants/memberOptions";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { AdminField, AdminFormShell } from "./ops/AdminFormShell";
import { MemberWorkflowDialog } from "./MemberWorkflowDialog";

const EMPTY_MEMBER = {
  first_name: "",
  last_name: "",
  email: "",
  college: "",
  year: "",
};

const DUPLICATE_EMAIL = "That email already belongs to a member.";

// A database unique violation on the email lands on the email field. The repo's
// own duplicate-email pre-check is mapped the same way in `createMember` below.
const CONSTRAINTS = {
  members_email: { field: "email", message: DUPLICATE_EMAIL },
  "(email)": { field: "email", message: DUPLICATE_EMAIL },
};

const selectCls =
  "min-h-[44px] w-full rounded border border-border-strong bg-surface2 p-2.5 text-sm";

export function AddMemberModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (member: AdminMemberSummary) => void | Promise<void>;
}) {
  const { form, submit, status, formError, discard, confirmDiscard } =
    useAdminForm({
      schema: AdminMemberSchema,
      defaultValues: EMPTY_MEMBER,
      successMessage: "Member created.",
      constraints: CONSTRAINTS,
      onSubmit: async (values) => {
        let member: AdminMemberSummary;
        try {
          member = await adminMembersRepository.createMember(values);
        } catch (error) {
          // The repo's duplicate-email check has no field; give it one so the
          // message sits beside the email input.
          if (
            error instanceof ValidationError &&
            !error.field &&
            /email already exists/i.test(error.message)
          ) {
            throw new ValidationError(error.message, "email");
          }
          throw error;
        }
        // The member exists now, so a list refresh failure must not read as
        // "could not create" (which would invite a duplicate).
        try {
          await onCreated(member);
        } catch (error) {
          console.error(error);
          toast.error(
            "Member created, but the list could not refresh. Reload the page.",
          );
        }
        return member;
      },
      onSuccess: onClose,
    });
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  const requestClose = () => {
    if (confirmDiscard()) onClose();
  };

  return (
    <MemberWorkflowDialog
      title="Add Member"
      busy={isSubmitting}
      onClose={requestClose}
    >
      <h2 className="text-lg font-semibold">Add Member</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Search Members first to avoid creating a duplicate. Add their event
        attendance after creating the member.
      </p>
      <AdminFormShell
        className="mt-5"
        label="Add Member"
        onSubmit={submit}
        status={status}
        formError={formError}
        errors={errors}
        onDiscard={discard}
        saveLabel="Create member"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={requestClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="First name" required error={errors.first_name?.message}>
            {(field) => (
              <Input
                {...field}
                autoComplete="given-name"
                {...register("first_name")}
              />
            )}
          </AdminField>
          <AdminField label="Last name" required error={errors.last_name?.message}>
            {(field) => (
              <Input
                {...field}
                autoComplete="family-name"
                {...register("last_name")}
              />
            )}
          </AdminField>
        </div>
        <AdminField label="Email (optional)" error={errors.email?.message}>
          {(field) => (
            <Input
              {...field}
              type="email"
              autoComplete="email"
              {...register("email")}
            />
          )}
        </AdminField>
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="College" error={errors.college?.message}>
            {(field) => (
              <select {...field} {...register("college")} className={selectCls}>
                <option value="">Unspecified</option>
                {MEMBER_COLLEGES.map((college) => (
                  <option key={college.value} value={college.value}>
                    {college.label}
                  </option>
                ))}
              </select>
            )}
          </AdminField>
          <AdminField label="Year" error={errors.year?.message}>
            {(field) => (
              <select {...field} {...register("year")} className={selectCls}>
                <option value="">Unspecified</option>
                {OFFICIAL_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            )}
          </AdminField>
        </div>
      </AdminFormShell>
    </MemberWorkflowDialog>
  );
}
