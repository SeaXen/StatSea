import { useEffect, useRef } from 'react';

interface UseModalA11yOptions {
    isOpen: boolean;
    onClose: () => void;
}

export function useModalA11y<T extends HTMLElement = HTMLDivElement>({
    isOpen,
    onClose,
}: UseModalA11yOptions) {
    const modalRef = useRef<T>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        previousActiveElement.current = document.activeElement as HTMLElement;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }

            if (e.key === 'Tab' && modalRef.current) {
                const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusableElements.length === 0) return;

                const first = focusableElements[0];
                const last = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        const timer = setTimeout(() => {
            if (modalRef.current) {
                const firstFocusable = modalRef.current.querySelector<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (firstFocusable) {
                    firstFocusable.focus();
                } else {
                    modalRef.current.focus();
                }
            }
        }, 50);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('keydown', handleKeyDown);
            if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
                previousActiveElement.current.focus();
            }
        };
    }, [isOpen, onClose]);

    return modalRef;
}
