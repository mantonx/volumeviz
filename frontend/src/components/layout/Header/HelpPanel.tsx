/**
 * HelpPanel - in-app quick reference.
 *
 * Scoped to explaining what's actually real in the app today, not a full
 * docs site. Content is written to be honest about limitations rather than
 * describing an idealized version of the product.
 */
import { Modal } from '@/components/ui/Modal';

interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
}

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="drawer"
      position="right"
      size="md"
      header={{ title: 'Help' }}
    >
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="font-semibold text-primary">VolumeViz</dt>
          <dd className="text-secondary">
            Discovers your Docker volumes and mounts, tracks their size over
            time. Read-only — it doesn't create or change volumes.
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-primary">Tracked</dt>
          <dd className="text-secondary">
            VolumeViz is actively scanning it. Toggle per-volume on the
            Volumes page, or automatically via rules.
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-primary">Orphaned</dt>
          <dd className="text-secondary">
            No running container has it attached right now. Normal between
            restarts, not an error.
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-primary">Rules</dt>
          <dd className="text-secondary">
            Include/exclude conditions (e.g. "exclude /home/*"). Highest
            priority wins on conflict. Build on the Rules page.
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-primary">Alerts (bell icon)</dt>
          <dd className="text-secondary">
            Firing alerts, active scans, recent scan errors. Empty is normal
            — it means nothing's wrong.
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-primary">Still in progress</dt>
          <dd className="text-secondary">
            Trends forecasting and some admin screens (audit logs,
            permissions) aren't wired to real data yet.
          </dd>
        </div>
      </dl>
    </Modal>
  );
}
