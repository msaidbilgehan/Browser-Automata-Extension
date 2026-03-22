import type { Template } from "@/shared/types/entities";
import templatesExport from "../../../Exports/templates.json";

/** Bundled templates loaded from Exports/templates.json */
export const BUNDLED_TEMPLATES: Template[] = templatesExport.templates as unknown as Template[];
