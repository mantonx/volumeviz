import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteVolumeModal } from './DeleteVolumeModal';

describe('DeleteVolumeModal', () => {
  const user = userEvent.setup();

  it('renders nothing when closed', () => {
    render(
      <DeleteVolumeModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        volumes={[{ name: 'vol-a' }]}
      />,
    );

    expect(screen.queryByText(/Delete 1 Volume/)).not.toBeInTheDocument();
  });

  it('lists every volume by name and the total size to be freed', () => {
    render(
      <DeleteVolumeModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        volumes={[
          { name: 'vol-a', size_bytes: 1024 },
          { name: 'vol-b', size_bytes: 2048 },
        ]}
      />,
    );

    expect(screen.getByText('vol-a')).toBeInTheDocument();
    expect(screen.getByText('vol-b')).toBeInTheDocument();
    // formatBytes(3072) — checked loosely since exact formatting isn't the
    // point of this test, just that the combined total appears somewhere.
    expect(screen.getByText(/3\s*KB|3072/i)).toBeInTheDocument();
  });

  it('keeps the confirm button disabled until "delete" is typed', async () => {
    const onConfirm = vi.fn();
    render(
      <DeleteVolumeModal
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
        volumes={[{ name: 'vol-a' }]}
      />,
    );

    const confirmButton = screen.getByRole('button', {
      name: /delete permanently/i,
    });
    expect(confirmButton).toBeDisabled();

    await user.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();

    const input = screen.getByLabelText(/type.*delete.*to confirm/i);
    await user.type(input, 'wrong word');
    expect(confirmButton).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'delete');
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('accepts the confirmation word case-insensitively and trims whitespace', async () => {
    render(
      <DeleteVolumeModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        volumes={[{ name: 'vol-a' }]}
      />,
    );

    const input = screen.getByLabelText(/type.*delete.*to confirm/i);
    await user.type(input, '  DELETE  ');

    expect(
      screen.getByRole('button', { name: /delete permanently/i }),
    ).toBeEnabled();
  });

  it('disables cancel/confirm and shows a deleting state while isDeleting is true', () => {
    render(
      <DeleteVolumeModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        volumes={[{ name: 'vol-a' }]}
        isDeleting
      />,
    );

    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /deleting/i }),
    ).toBeInTheDocument();
  });

  it('shows per-volume failures distinctly from the volumes still pending', () => {
    render(
      <DeleteVolumeModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        volumes={[{ name: 'attached-vol' }]}
        failures={[
          { volume_id: 'attached-vol', error: 'still attached to 1 container(s)' },
        ]}
      />,
    );

    expect(
      screen.getByText(/could not be deleted/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/still attached to 1 container\(s\)/i),
    ).toBeInTheDocument();
  });

  it('calls onClose (not onConfirm) when Cancel is clicked', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DeleteVolumeModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        volumes={[{ name: 'vol-a' }]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
