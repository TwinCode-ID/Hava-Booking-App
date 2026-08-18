import React from "react";
import { Fingerprint, Loader2, RefreshCw, Trash2 } from "lucide-react";

const TRANSPORT_LABELS = {
  ble: "Bluetooth",
  cable: "Cable",
  hybrid: "Phone or tablet",
  internal: "Built-in",
  nfc: "NFC",
  "smart-card": "Smart card",
  usb: "USB",
};

const formatDate = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatDeviceType = (value) => {
  if (!value) return null;
  if (value === "multiDevice") return "Synced passkey";
  if (value === "singleDevice") return "Device-bound passkey";

  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
};

const PasskeyList = ({
  passkeys,
  isLoading,
  error,
  deletingPasskeyId,
  onRetry,
  onDelete,
}) => {
  if (isLoading) {
    return (
      <div className='mt-8 border-t border-gray-100 pt-6 flex items-center gap-2 text-sm text-gray-500'>
        <Loader2 className='w-4 h-4 animate-spin text-emerald-600' />
        Loading registered passkeys...
      </div>
    );
  }

  if (error && passkeys.length === 0) {
    return (
      <div
        role='alert'
        className='mt-8 border-t border-gray-100 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
        <p className='text-sm text-red-600'>{error}</p>
        <button
          type='button'
          onClick={onRetry}
          className='inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-bold hover:bg-red-50 transition-colors'>
          <RefreshCw className='w-4 h-4' />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className='mt-8 border-t border-gray-100 pt-6'>
      {error && (
        <div
          role='alert'
          className='mb-5 rounded-xl border border-red-100 bg-red-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
          <p className='text-sm text-red-600'>{error}</p>
          <button
            type='button'
            onClick={onRetry}
            className='inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-bold hover:bg-red-100 transition-colors'>
            <RefreshCw className='w-4 h-4' />
            Try Again
          </button>
        </div>
      )}
      <div className='flex items-center justify-between gap-3 mb-4'>
        <h4 className='text-sm font-bold text-gray-900'>Registered passkeys</h4>
        <span className='text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full'>
          {passkeys.length}
        </span>
      </div>

      {passkeys.length === 0 ? (
        <div className='rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center'>
          <Fingerprint className='w-6 h-6 text-gray-400 mx-auto mb-2' />
          <p className='text-sm font-semibold text-gray-700'>
            No passkeys registered yet
          </p>
          <p className='text-xs text-gray-500 mt-1'>
            Register one to sign in using your device's screen lock or
            biometrics.
          </p>
        </div>
      ) : (
        <div className='space-y-3'>
          {passkeys.map((passkey, index) => {
            const passkeyId = passkey.id || passkey._id;
            const passkeyName =
              passkey.name || passkey.deviceName || `Passkey ${index + 1}`;
            const createdAt = formatDate(passkey.createdAt);
            const lastUsedAt = formatDate(passkey.lastUsedAt);
            const deviceType = formatDeviceType(passkey.deviceType);
            const transports = Array.isArray(passkey.transports)
              ? passkey.transports
                  .map((transport) => TRANSPORT_LABELS[transport] || transport)
                  .join(", ")
              : null;
            const isDeleting = deletingPasskeyId === passkeyId;

            return (
              <div
                key={passkeyId || `${passkeyName}-${index}`}
                className='rounded-xl border border-gray-200 p-4 flex items-start gap-3'>
                <div className='p-2 bg-emerald-50 rounded-lg shrink-0'>
                  <Fingerprint className='w-4 h-4 text-emerald-700' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-bold text-gray-900 truncate'>
                    {passkeyName}
                  </p>
                  <div className='mt-1 space-y-0.5 text-xs text-gray-500'>
                    {createdAt && <p>Added {createdAt}</p>}
                    <p>
                      {lastUsedAt
                        ? `Last used ${lastUsedAt}`
                        : "No use recorded"}
                    </p>
                    {(deviceType || transports || passkey.backedUp) && (
                      <p>
                        {[deviceType, passkey.backedUp ? "Backed up" : null, transports]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type='button'
                  onClick={() => onDelete(passkey)}
                  disabled={!passkeyId || Boolean(deletingPasskeyId)}
                  aria-label={`Delete ${passkeyName}`}
                  className='p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0'>
                  {isDeleting ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <Trash2 className='w-4 h-4' />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PasskeyList;
