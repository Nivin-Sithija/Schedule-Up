import {z} from 'zod';
import {templateCategories} from './templates.js';
export const templateSchema=z.object({title:z.string().trim().min(1).max(100),text:z.string().trim().min(1).max(4000),category:z.enum(templateCategories).default('replies')});
