import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "react-query";
import toast from "react-hot-toast";
import {
  adminMembersRepository,
  AdminMemberSummary,
} from "../../../data/repos/adminMembers";
import { toUserMessage } from "../../../data/errors";
import { AdminMemberInput, AdminMemberSchema } from "../../../schemas";
import { OFFICIAL_YEARS } from "../../../lib/yearNormalizer";
import { MEMBER_COLLEGES } from "../../../constants/memberOptions";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { MemberWorkflowDialog } from "./MemberWorkflowDialog";

export function AddMemberModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (member: AdminMemberSummary) => void | Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminMemberInput>({
    resolver: zodResolver(AdminMemberSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      college: "",
      year: "",
    },
  });
  const create = useMutation(
    (values: AdminMemberInput) => adminMembersRepository.createMember(values),
    {
      onSuccess: async (member) => {
        await onCreated(member);
        toast.success("Member created.");
        onClose();
      },
    },
  );
  return (
    <MemberWorkflowDialog
      title="Add Member"
      busy={create.isLoading}
      onClose={onClose}
    >
      <h2 className="text-lg font-semibold">Add Member</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Search Members first to avoid creating a duplicate. Add their event
        attendance after creating the member.
      </p>
      <form
        onSubmit={handleSubmit((values) => create.mutate(values))}
        className="mt-5 space-y-4"
      >
        <fieldset disabled={create.isLoading} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="new-member-first"
                className="mb-1 block text-sm font-medium"
              >
                First name
              </label>
              <Input
                id="new-member-first"
                autoComplete="given-name"
                aria-invalid={!!errors.first_name}
                {...register("first_name")}
              />
              {errors.first_name && (
                <p
                  role="alert"
                  className="mt-1 text-sm text-red-700 dark:text-red-400"
                >
                  {errors.first_name.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="new-member-last"
                className="mb-1 block text-sm font-medium"
              >
                Last name
              </label>
              <Input
                id="new-member-last"
                autoComplete="family-name"
                aria-invalid={!!errors.last_name}
                {...register("last_name")}
              />
              {errors.last_name && (
                <p
                  role="alert"
                  className="mt-1 text-sm text-red-700 dark:text-red-400"
                >
                  {errors.last_name.message}
                </p>
              )}
            </div>
          </div>
          <div>
            <label
              htmlFor="new-member-email"
              className="mb-1 block text-sm font-medium"
            >
              Email (optional)
            </label>
            <Input
              id="new-member-email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p
                role="alert"
                className="mt-1 text-sm text-red-700 dark:text-red-400"
              >
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="new-member-college"
                className="mb-1 block text-sm font-medium"
              >
                College
              </label>
              <select
                id="new-member-college"
                {...register("college")}
                className="w-full rounded border border-border-strong bg-surface2 p-2.5 text-sm"
              >
                <option value="">Unspecified</option>
                {MEMBER_COLLEGES.map((college) => (
                  <option key={college.value} value={college.value}>
                    {college.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="new-member-year"
                className="mb-1 block text-sm font-medium"
              >
                Year
              </label>
              <select
                id="new-member-year"
                {...register("year")}
                className="w-full rounded border border-border-strong bg-surface2 p-2.5 text-sm"
              >
                <option value="">Unspecified</option>
                {OFFICIAL_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>
        {create.isError && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {toUserMessage(
              create.error,
              "Could not create the member. Try again.",
            )}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={create.isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" loading={create.isLoading}>
            {create.isLoading ? "Creating…" : "Create member"}
          </Button>
        </div>
      </form>
    </MemberWorkflowDialog>
  );
}
