import type { Template } from "@/shared/types/entities";

import cookieBannerDismisser from "../../../Templates/cookie-banner-dismisser.json";
import videoNavigator from "../../../Templates/video-navigator.json";
import elementHider from "../../../Templates/element-hider.json";
import darkModeInjector from "../../../Templates/dark-mode-injector.json";
import autoClicker from "../../../Templates/auto-clicker.json";

interface TemplateFile {
  templates: unknown[];
}

/** Bundled templates loaded from Templates/*.json */
export const BUNDLED_TEMPLATES: Template[] = (
  [
    cookieBannerDismisser,
    videoNavigator,
    elementHider,
    darkModeInjector,
    autoClicker,
  ] as TemplateFile[]
).flatMap((file) => file.templates) as Template[];
