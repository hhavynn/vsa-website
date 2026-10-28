import type { FeedbackFormData } from "../../schemas";
import { supabase } from "../../lib/supabase";
import { ValidationError, withErrorHandling } from "../errors";

const unavailable = "Feedback is unavailable. Please try again later.";

export const feedbackRepository = {
  async submit(input: FeedbackFormData): Promise<void> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.functions.invoke(
        "submit-feedback",
        {
          body: {
            type: input.type,
            title: input.title.trim(),
            description: input.description.trim(),
            name: input.name?.trim() ?? "",
            email: input.email?.trim() ?? "",
          },
        },
      );
      if (error) {
        const status = error.context?.status;
        if (status === 429)
          throw new ValidationError(
            "Too many feedback submissions. Please try again later.",
          );
        if (status === 401)
          throw new ValidationError(
            "Your session could not be verified. Sign in again or submit while signed out.",
          );
        throw new ValidationError(unavailable);
      }
      if (data?.success !== true) throw new ValidationError(unavailable);
    });
  },
};
