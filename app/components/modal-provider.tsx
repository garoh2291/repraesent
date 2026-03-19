"use client";

import { Dialog } from "~/components/ui/dialog";
import {
  useState,
  createContext,
  useContext,
  type ComponentPropsWithoutRef,
  lazy,
} from "react";

interface BaseModalProps {
  isOpen?: boolean;
  setIsOpen?: (isOpen: boolean) => void;
  onClose?: () => void;
}

const ConfirmationModal = lazy(
  () => import("~/components/organism/modals/confirm-modal")
);

const SwitchWorkspaceModal = lazy(
  () => import("~/components/organism/modals/switch-workspace-modal")
);

const Modals = {
  ConfirmationModal,
  SwitchWorkspaceModal,
} as const;

type ModalComponents = {
  [K in keyof typeof Modals]: (typeof Modals)[K] extends React.ComponentType<
    infer P
  >
    ? React.ComponentType<P & BaseModalProps>
    : (typeof Modals)[K];
};

type ModalContextType = {
  openModal: ({
    modalName,
    props,
  }: {
    modalName: keyof typeof Modals;
    props?: ComponentPropsWithoutRef<ModalComponents[keyof ModalComponents]>;
  }) => void;
  isOpen: boolean;
};

const ModalContext = createContext<ModalContextType>({
  openModal: () => {},
  isOpen: false,
});

export function useModal() {
  const modal = useContext(ModalContext);
  return modal;
}

type Modal = keyof typeof Modals;
type ModalState<T = any> = {
  component: keyof typeof Modals | null;
  props?: T;
};

export default function ModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({ component: null });

  const ModalComponent = modalState.component
    ? Modals[modalState.component]
    : null;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      modalState.props?.onClose?.();
      setIsOpen(false);
      setTimeout(() => {
        setModalState({ component: null });
      }, 200); // small delay to allow for closing animation
    } else {
      setIsOpen(true);
    }
  };

  return (
    <ModalContext.Provider
      value={{
        openModal: ({ modalName, props }) => {
          setModalState({ component: modalName, props });
          setIsOpen(true);
        },
        isOpen,
      }}
    >
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        {ModalComponent && (
          <ModalComponent
            {...modalState.props}
            isOpen={isOpen}
            setIsOpen={(open: boolean) => {
              handleOpenChange(open);
            }}
          />
        )}
      </Dialog>
      {children}
    </ModalContext.Provider>
  );
}
