import { CreateProjectSchema, UpdateProjectSchema } from "@yunpu/shared";
import { z } from "zod";

export { CreateProjectSchema, UpdateProjectSchema };

export const ProjectIdParamsSchema = z.object({
  projectId: z.uuid(),
});

export const ListProjectsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sort: z.literal("recent").optional(),
});
