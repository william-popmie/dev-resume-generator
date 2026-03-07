import { z } from 'zod'

export const PositionSchema = z.object({
  title: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  location: z.string().optional().default(''),
  linkedin_description: z.string().optional().default(''),
})

export const CompanySchema = z.object({
  company: z.string(),
  location: z.string().optional().default(''),
  positions: z.array(PositionSchema),
})

export const EducationSchema = z.object({
  school: z.string(),
  degree: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  location: z.string().optional().default(''),
})

export const SkillCategorySchema = z.object({
  category: z.string(),
  skills: z.string(),
})

export const ResumeDataSchema = z.object({
  name: z.string(),
  phone: z.string().optional().default(''),
  email: z.string().optional().default(''),
  linkedin_url: z.string().optional().default(''),
  location: z.string().optional().default(''),
  work_experience: z.array(CompanySchema),
  education: z.array(EducationSchema),
  skills: z.array(SkillCategorySchema),
})

export type ResumeData = z.infer<typeof ResumeDataSchema>
export type Company = z.infer<typeof CompanySchema>
export type Position = z.infer<typeof PositionSchema>
export type Education = z.infer<typeof EducationSchema>
export type SkillCategory = z.infer<typeof SkillCategorySchema>
