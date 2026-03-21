import type {
  BrowserAutomataExport,
  EntityId,
  Flow,
  Script,
  ExtractionRule,
  Profile,
} from "@/shared/types/entities";
import type { DependencySummary } from "@/shared/types/import-export";
import { localStore } from "@/shared/storage";

/**
 * Collect entity IDs referenced by shortcuts in their actions.
 */
function collectShortcutDeps(shortcuts: BrowserAutomataExport["shortcuts"]): {
  flowIds: Set<string>;
  scriptIds: Set<string>;
  extractionRuleIds: Set<string>;
  profileIds: Set<string>;
} {
  const flowIds = new Set<string>();
  const scriptIds = new Set<string>();
  const extractionRuleIds = new Set<string>();
  const profileIds = new Set<string>();

  if (!shortcuts) return { flowIds, scriptIds, extractionRuleIds, profileIds };

  for (const shortcut of shortcuts) {
    if (shortcut.profileId) profileIds.add(shortcut.profileId as string);

    switch (shortcut.action.type) {
      case "flow":
        flowIds.add(shortcut.action.flowId as string);
        break;
      case "script":
        scriptIds.add(shortcut.action.scriptId as string);
        break;
      case "extraction":
        extractionRuleIds.add(shortcut.action.extractionRuleId as string);
        break;
    }
  }

  return { flowIds, scriptIds, extractionRuleIds, profileIds };
}

/**
 * Collect entity IDs referenced by flow nodes.
 */
function collectFlowDeps(flows: Flow[]): {
  scriptIds: Set<string>;
  extractionRuleIds: Set<string>;
  profileIds: Set<string>;
} {
  const scriptIds = new Set<string>();
  const extractionRuleIds = new Set<string>();
  const profileIds = new Set<string>();

  for (const flow of flows) {
    if (flow.profileId) profileIds.add(flow.profileId as string);

    for (const node of flow.nodes) {
      switch (node.config.type) {
        case "script":
          scriptIds.add(node.config.scriptId as string);
          break;
        case "run_extraction":
          extractionRuleIds.add(node.config.extractionRuleId as string);
          break;
      }
    }
  }

  return { scriptIds, extractionRuleIds, profileIds };
}

/**
 * Collect profileIds from scripts, extraction rules, and other entities.
 */
function collectProfileIds(entities: { profileId: EntityId | null }[]): Set<string> {
  const profileIds = new Set<string>();
  for (const entity of entities) {
    if (entity.profileId) profileIds.add(entity.profileId as string);
  }
  return profileIds;
}

/**
 * Resolve transitive dependencies for a filtered export.
 * Walks: Shortcuts → Flows/Scripts/ExtractionRules → Scripts/ExtractionRules → Profiles
 * Returns the augmented export and a summary of what was added.
 */
export async function resolveDependencies(
  filteredExport: BrowserAutomataExport,
): Promise<{ data: BrowserAutomataExport; summary: DependencySummary }> {
  // Load all storage records we may need
  const allFlows = (await localStore.get("flows")) ?? {};
  const allScripts = (await localStore.get("scripts")) ?? {};
  const allExtractionRules = (await localStore.get("extractionRules")) ?? {};
  const allProfiles = (await localStore.get("profiles")) ?? {};

  // Track IDs already present in the export (use string sets since EntityId is branded)
  const existingFlowIds = new Set<string>((filteredExport.flows ?? []).map((f) => f.id as string));
  const existingScriptIds = new Set<string>(
    (filteredExport.scripts ?? []).map((s) => s.id as string),
  );
  const existingExtractionRuleIds = new Set<string>(
    (filteredExport.extractionRules ?? []).map((r) => r.id as string),
  );
  const existingProfileIds = new Set<string>(
    (filteredExport.profiles ?? []).map((p) => p.id as string),
  );

  // Collect all needed IDs
  const neededFlowIds = new Set<string>();
  const neededScriptIds = new Set<string>();
  const neededExtractionRuleIds = new Set<string>();
  const neededProfileIds = new Set<string>();

  // Pass 1: Scan shortcuts
  const shortcutDeps = collectShortcutDeps(filteredExport.shortcuts);
  for (const id of shortcutDeps.flowIds) {
    if (!existingFlowIds.has(id)) neededFlowIds.add(id);
  }
  for (const id of shortcutDeps.scriptIds) {
    if (!existingScriptIds.has(id)) neededScriptIds.add(id);
  }
  for (const id of shortcutDeps.extractionRuleIds) {
    if (!existingExtractionRuleIds.has(id)) neededExtractionRuleIds.add(id);
  }
  for (const id of shortcutDeps.profileIds) {
    if (!existingProfileIds.has(id)) neededProfileIds.add(id);
  }

  // Pass 2: Scan flows (existing + newly needed)
  const allFlowsToScan: Flow[] = [...(filteredExport.flows ?? [])];
  for (const id of neededFlowIds) {
    const flow = allFlows[id];
    if (flow) allFlowsToScan.push(flow);
  }

  const flowDeps = collectFlowDeps(allFlowsToScan);
  for (const id of flowDeps.scriptIds) {
    if (!existingScriptIds.has(id)) neededScriptIds.add(id);
  }
  for (const id of flowDeps.extractionRuleIds) {
    if (!existingExtractionRuleIds.has(id)) neededExtractionRuleIds.add(id);
  }
  for (const id of flowDeps.profileIds) {
    if (!existingProfileIds.has(id)) neededProfileIds.add(id);
  }

  // Pass 3: Collect profileIds from newly resolved scripts/extraction rules
  const resolvedScripts: Script[] = [];
  for (const id of neededScriptIds) {
    const script = allScripts[id];
    if (script) resolvedScripts.push(script);
  }

  const resolvedExtractionRules: ExtractionRule[] = [];
  for (const id of neededExtractionRuleIds) {
    const rule = allExtractionRules[id];
    if (rule) resolvedExtractionRules.push(rule);
  }

  const scriptProfileIds = collectProfileIds(resolvedScripts);
  const ruleProfileIds = collectProfileIds(resolvedExtractionRules);
  for (const id of scriptProfileIds) {
    if (!existingProfileIds.has(id)) neededProfileIds.add(id);
  }
  for (const id of ruleProfileIds) {
    if (!existingProfileIds.has(id)) neededProfileIds.add(id);
  }

  // Resolve all needed entities from storage
  const addedFlows: Flow[] = [];
  for (const id of neededFlowIds) {
    const flow = allFlows[id];
    if (flow) addedFlows.push(flow);
  }

  const addedProfiles: Profile[] = [];
  for (const id of neededProfileIds) {
    const profile = allProfiles[id];
    if (profile) addedProfiles.push(profile);
  }

  // Build augmented export
  const augmented: BrowserAutomataExport = {
    ...filteredExport,
    flows: [...(filteredExport.flows ?? []), ...addedFlows],
    scripts: [...(filteredExport.scripts ?? []), ...resolvedScripts],
    extractionRules: [...(filteredExport.extractionRules ?? []), ...resolvedExtractionRules],
    profiles: [...(filteredExport.profiles ?? []), ...addedProfiles],
  };

  const summary: DependencySummary = {
    addedFlows: addedFlows.length,
    addedScripts: resolvedScripts.length,
    addedExtractionRules: resolvedExtractionRules.length,
    addedProfiles: addedProfiles.length,
  };

  return { data: augmented, summary };
}
