import { toast as sonnerToast } from 'sonner';

const toastStyles = {
    error: {
        style: {
            background: '#b91c1c',
            color: 'white',
            border: '2px solid #991b1b',
        },
    },
    success: {
        style: {
            background: '#16a34a',
            color: 'white',
            border: '2px solid #15803d',
        },
    },
    warning: {
        style: {
            background: '#ea580c',
            color: 'white',
            border: '2px solid #c2410c',
        },
    },
    info: {
        style: {
            background: '#2563eb',
            color: 'white',
            border: '2px solid #1d4ed8',
        },
    },
};

export const toast = {
    error: (message: string, options?: Parameters<typeof sonnerToast.error>[1]) =>
        sonnerToast.error(message, { ...toastStyles.error, ...options }),
    success: (message: string, options?: Parameters<typeof sonnerToast.success>[1]) =>
        sonnerToast.success(message, { ...toastStyles.success, ...options }),
    warning: (message: string, options?: Parameters<typeof sonnerToast.warning>[1]) =>
        sonnerToast.warning(message, { ...toastStyles.warning, ...options }),
    info: (message: string, options?: Parameters<typeof sonnerToast.info>[1]) =>
        sonnerToast.info(message, { ...toastStyles.info, ...options }),
};
