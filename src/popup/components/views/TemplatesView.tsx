import { useState } from "react";
import { Package, Download, Check } from "lucide-react";
import { BUNDLED_TEMPLATES } from "@/data/templates";
import { sendToBackground } from "@/shared/messaging";
import type { TemplateCategory } from "@/shared/types/entities";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  form_fill: "Form Fill",
  scraping: "Scraping",
  navigation: "Navigation",
  ui_modification: "UI Mod",
  accessibility: "Accessibility",
  productivity: "Productivity",
  privacy: "Privacy",
  custom: "Custom",
};

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  form_fill: "bg-warning/20 text-warning",
  scraping: "bg-active/20 text-active",
  navigation: "bg-active-dim/20 text-active-dim",
  ui_modification: "bg-error/20 text-error",
  accessibility: "bg-active/20 text-active",
  productivity: "bg-warning/20 text-warning",
  privacy: "bg-error-dim/20 text-error-dim",
  custom: "bg-bg-tertiary text-text-muted",
};

export function TemplatesView() {
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleInstall = async (templateId: string) => {
    setInstalling(templateId);
    setError(null);
    try {
      await sendToBackground({ type: "INSTALL_TEMPLATE", templateId });
      setInstalled((prev) => new Set(prev).add(templateId));
    } catch (err) {
      setError(`Failed to install: ${String(err)}`);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-text-primary text-sm font-semibold">Templates</h2>
        <span className="text-text-muted text-[10px]">
          {String(BUNDLED_TEMPLATES.length)} available
        </span>
      </div>

      {error ? (
        <div className="border-error-dim bg-error-dim/10 rounded-md border p-2">
          <p className="text-error text-xs">{error}</p>
        </div>
      ) : null}

      {BUNDLED_TEMPLATES.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Package size={32} className="text-text-muted" />
          <p className="text-text-muted text-xs">No templates available</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {BUNDLED_TEMPLATES.map((template) => {
            const isInstalled = installed.has(template.id);
            const isInstalling = installing === template.id;

            return (
              <Card key={template.id}>
                <div className="flex h-full flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-text-primary text-xs leading-tight font-medium">
                      {template.name}
                    </p>
                  </div>

                  <span
                    className={`inline-flex w-fit rounded px-1.5 py-0.5 text-[9px] font-medium ${
                      CATEGORY_COLORS[template.category]
                    }`}
                  >
                    {CATEGORY_LABELS[template.category]}
                  </span>

                  <p className="text-text-muted flex-1 text-[10px] leading-snug">
                    {template.description}
                  </p>

                  {template.author ? (
                    <p className="text-text-muted text-[9px]">by {template.author}</p>
                  ) : null}

                  <div className="pt-1">
                    {isInstalled ? (
                      <span className="text-active inline-flex items-center gap-1 text-[10px] font-medium">
                        <Check size={10} />
                        Installed
                      </span>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => void handleInstall(template.id)}
                        disabled={isInstalling}
                        className="gap-1"
                      >
                        <Download size={10} />
                        {isInstalling ? "Installing..." : "Install"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
