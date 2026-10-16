import React from 'react';
import { Dialog, DialogButton } from '../../../../components/ui/Dialog';

export const DeleteConfirmModal = ({ visible, title, message, onCancel, onConfirm }) => (
  <Dialog
    visible={visible}
    onClose={onCancel}
    title={title}
    message={message}
    buttons={(
      <>
        <DialogButton title="Отмена" onPress={onCancel} />
        <DialogButton title="Удалить" variant="danger" onPress={onConfirm} />
      </>
    )}
  />
);
