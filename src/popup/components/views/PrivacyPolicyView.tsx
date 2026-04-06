import { ArrowLeft, ExternalLink } from "lucide-react";
import { memo } from "react";
import { useAppStore } from "../../stores/app-store";

const GITHUB_POLICY_URL =
  "https://github.com/msaidbilgehan/Browser-Automata-Extension/blob/master/PRIVACY_POLICY.md";

export const PrivacyPolicyView = memo(function PrivacyPolicyView() {
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab("settings"); }}
            className="text-text-muted hover:bg-bg-tertiary hover:text-text-primary rounded p-1 transition-colors"
            aria-label="Back to settings"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-text-primary text-sm font-semibold">
            Privacy Policy
          </h2>
        </div>
        <a
          href={GITHUB_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-active hover:text-active/80 flex items-center gap-1 text-xs transition-colors"
        >
          View on GitHub
          <ExternalLink size={12} />
        </a>
      </div>

      <p className="text-text-muted text-xs">Last updated: 2026-04-06</p>

      <Section title="Summary">
        <P>
          Browser Automata is a privacy-focused Chrome extension. All user data
          is stored locally on your device. No personal data is collected,
          transmitted, or shared with any third party.
        </P>
      </Section>

      <Section title="Data Storage">
        <P>
          All data created and managed by Browser Automata is stored exclusively
          in your browser using <Code>chrome.storage.local</Code> and{" "}
          <Code>chrome.storage.sync</Code>:
        </P>
        <Ul>
          <Li>
            <Strong>Local storage:</Strong> Scripts, shortcuts, flows, CSS
            rules, extraction rules, network rules, profiles, clipboard history,
            activity logs, form fill profiles, site adapters, installed
            templates, quick-run actions, and health metrics.
          </Li>
          <Li>
            <Strong>Sync storage:</Strong> UI preferences only (theme, icon
            color, execution settings, notification preferences). These sync
            across your devices through Chrome&apos;s built-in sync if enabled.
          </Li>
        </Ul>
        <P>No data is stored on external servers.</P>
      </Section>

      <Section title="Data Collection">
        <P>Browser Automata does not collect:</P>
        <Ul>
          <Li>Personal information (name, email, address, etc.)</Li>
          <Li>Browsing history or habits</Li>
          <Li>Analytics or telemetry data</Li>
          <Li>Tracking identifiers or cookies</Li>
          <Li>Crash reports</Li>
        </Ul>
      </Section>

      <Section title="Network Requests">
        <P>Browser Automata makes one optional network request:</P>
        <Ul>
          <Li>
            <Strong>Template registry fetch:</Strong> A read-only GET request to
            a public GitHub repository to retrieve available automation
            templates. No user data is sent. This occurs only when you
            explicitly open the Templates view or click Refresh.
          </Li>
        </Ul>
        <P>
          No other network requests are made. No user data ever leaves your
          browser.
        </P>
      </Section>

      <Section title="Permissions">
        <P>
          All requested browser permissions are used solely for automation
          functionality:
        </P>
        <div className="border-border overflow-hidden rounded border text-xs">
          <table className="w-full">
            <thead>
              <tr className="bg-bg-tertiary text-text-muted">
                <th className="px-3 py-1.5 text-left font-medium">
                  Permission
                </th>
                <th className="px-3 py-1.5 text-left font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-text-secondary divide-border divide-y">
              <PermRow
                perm="storage"
                desc="Store scripts, settings, and configurations locally"
              />
              <PermRow
                perm="activeTab"
                desc="Interact with the current tab when you trigger an action"
              />
              <PermRow
                perm="scripting"
                desc="Execute your automation scripts on web pages"
              />
              <PermRow
                perm="tabs"
                desc="Query and communicate with browser tabs"
              />
              <PermRow perm="alarms" desc="Schedule automation tasks" />
              <PermRow
                perm="clipboard*"
                desc="Read/write clipboard for automation workflows"
              />
              <PermRow
                perm="notifications"
                desc="Display alerts from page-monitoring rules"
              />
              <PermRow
                perm="declarativeNetRequest"
                desc="Apply custom network rules and CSP modifications"
              />
              <PermRow
                perm="downloads"
                desc="Export your data as files"
              />
              <PermRow
                perm="<all_urls>"
                desc="Run automation on any website you choose"
              />
            </tbody>
          </table>
        </div>
        <P>None of these permissions are used for data collection or tracking.</P>
      </Section>

      <Section title="Third-Party Services">
        <P>
          Browser Automata does not integrate with any third-party analytics,
          advertising, or tracking services.
        </P>
      </Section>

      <Section title="User Control">
        <P>You have full control over your data:</P>
        <Ul>
          <Li>
            <Strong>View:</Strong> All stored data is accessible through the
            extension UI.
          </Li>
          <Li>
            <Strong>Export:</Strong> Download your data as JSON files via
            Import/Export.
          </Li>
          <Li>
            <Strong>Delete:</Strong> Remove individual items or uninstall the
            extension to delete all data.
          </Li>
          <Li>
            <Strong>Disable:</Strong> Use the global toggle to disable
            functionality without losing data.
          </Li>
        </Ul>
      </Section>

      <Section title="Children's Privacy">
        <P>
          Browser Automata does not knowingly collect any data from children
          under the age of 13.
        </P>
      </Section>

      <Section title="Changes to This Policy">
        <P>
          If this policy is updated, changes will be reflected with an updated
          date. Continued use after changes constitutes acceptance.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          Questions? Open an issue on the{" "}
          <a
            href="https://github.com/msaidbilgehan/Browser-Automata-Extension"
            target="_blank"
            rel="noopener noreferrer"
            className="text-active hover:text-active/80 underline"
          >
            GitHub repository
          </a>
          .
        </P>
      </Section>
    </div>
  );
});

/* ── Tiny helper components ── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-text-primary text-xs font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-text-secondary text-xs leading-relaxed">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="text-text-secondary flex flex-col gap-1 pl-4 text-xs leading-relaxed list-disc">
      {children}
    </ul>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="text-text-primary font-medium">{children}</span>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-bg-tertiary rounded px-1 py-0.5 text-[11px]">
      {children}
    </code>
  );
}

function PermRow({ perm, desc }: { perm: string; desc: string }) {
  return (
    <tr>
      <td className="px-3 py-1.5">
        <code className="bg-bg-tertiary rounded px-1 py-0.5 text-[11px]">
          {perm}
        </code>
      </td>
      <td className="px-3 py-1.5">{desc}</td>
    </tr>
  );
}
