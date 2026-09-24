import { z } from "zod";
import { ROLES } from "@/lib/permissions";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const timesheetCreateSchema = z.object({
  date: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date"),
  clientId: z.coerce.number().int().positive(),
  projectId: z.coerce.number().int().positive(),
  taskId: z.coerce.number().int().positive(),
  description: z.string().min(1, "Description required").max(2000),
  hours: z.coerce.number().min(0).max(24),
  type: z.string().min(1).max(50),
  status: z.enum(["DRAFT", "SUBMITTED"]).default("DRAFT"),
});

export const timesheetUpdateSchema = timesheetCreateSchema.partial().extend({
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
  rejectionNote: z.string().max(2000).optional().nullable(),
});

export const clientSchema = z.object({
  clientCode: z.string().min(1).max(20),
  clientName: z.string().min(1).max(120),
  isActive: z.boolean().optional(),
});

export const projectSchema = z.object({
  activityId: z.string().min(1).max(60),
  description: z.string().min(1).max(200),
  clientId: z.coerce.number().int().positive(),
  isActive: z.boolean().optional(),
});

export const taskSchema = z.object({
  taskId: z.string().min(1).max(40),
  taskName: z.string().min(1).max(200),
  poRef: z.string().max(80).optional().nullable(),
  projectId: z.coerce.number().int().positive(),
  isActive: z.boolean().optional(),
});

export const userSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(ROLES),
  employeeCode: z.string().min(1).max(20),
  isActive: z.boolean().optional(),
});

export const sandboxCreateSchema = z.object({
  sandboxLabel: z.string().min(1).max(120),
  dateFrom: z.string(),
  dateTo: z.string(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED"]).default("APPROVED"),
});

export const sandboxEntrySchema = z.object({
  sandboxLabel: z.string().min(1),
  userId: z.coerce.number().int().positive(),
  clientId: z.coerce.number().int().positive(),
  projectId: z.coerce.number().int().positive(),
  taskId: z.coerce.number().int().positive(),
  date: z.string(),
  description: z.string().min(1).max(2000),
  hours: z.coerce.number().min(0).max(24),
  type: z.string().min(1),
  managerNote: z.string().max(2000).optional().nullable(),
});

export const misGenerateSchema = z.object({
  source: z.enum(["timesheets", "sandbox"]),
  sandboxLabel: z.string().optional(),
  dateFrom: z.string(),
  dateTo: z.string(),
  employeeIds: z.array(z.coerce.number()).optional(),
  clientIds: z.array(z.coerce.number()).optional(),
});
