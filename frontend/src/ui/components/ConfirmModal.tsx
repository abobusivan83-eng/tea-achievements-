import { Modal } from "./Modal";
import { Button } from "./Button";
import { FiAlertTriangle, FiTrash2 } from "react-icons/fi";

export function ConfirmModal(props: {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  return (
    <Modal open={props.open} title={props.title ?? "Confirm"} onClose={props.onCancel}>
      <div className="grid gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-yellow-300">
            <FiAlertTriangle />
          </div>
          <div className="text-sm text-steam-muted">{props.message}</div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={props.onCancel}>
            {props.cancelText ?? "Cancel"}
          </Button>
          <Button
            variant={props.danger ? "danger" : "primary"}
            leftIcon={props.danger ? <FiTrash2 /> : undefined}
            onClick={props.onConfirm}
          >
            {props.confirmText ?? "Confirm"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

