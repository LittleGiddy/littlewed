import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/**
 * The teal focus-ring input style repeated across 15 files, expressed once.
 * Exported on its own so it can be dropped onto elements that are not <input>
 * (e.g. a styled <div> acting as a control) during incremental migration.
 */
export const fieldClasses = [
  'w-full px-3.5 py-2.5 text-sm text-gray-900',
  'bg-white border border-gray-200 rounded-tap',
  'placeholder:text-gray-300',
  'transition-all duration-150 ease-soft',
  'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10',
  'disabled:bg-gray-50 disabled:text-gray-400',
  'readonly:bg-gray-50',
].join(' ');

type AppFieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  /** Receives the props for the underlying control, so callers can spread them. */
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
  className?: string;
};

/**
 * Label + control + hint/error wrapper with generated ids so `htmlFor`,
 * `aria-describedby` and `aria-invalid` are wired for screen readers.
 */
export function AppField({
  label,
  hint,
  error,
  required,
  children,
  className = '',
}: AppFieldProps) {
  const id = `${useId()}-f`;
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="block text-[13px] font-semibold text-gray-700 mb-1.5">
          {label}
          {required ? (
            <span className="text-danger ml-0.5" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}

      {error ? (
        <p id={`${id}-err`} className="text-[12px] text-danger mt-1.5 font-medium">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-gray-400 mt-1.5">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type AppInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  fieldClassName?: string;
};

export function AppInput({
  label,
  hint,
  error,
  required,
  fieldClassName,
  className = '',
  ...rest
}: AppInputProps) {
  return (
    <AppField
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      {(fieldProps) => (
        <input
          {...rest}
          {...fieldProps}
          className={`${fieldClasses} ${error ? 'border-danger focus:border-danger focus:ring-danger/15' : ''} ${className}`}
        />
      )}
    </AppField>
  );
}

type AppTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  fieldClassName?: string;
};

export function AppTextarea({
  label,
  hint,
  error,
  required,
  fieldClassName,
  className = '',
  ...rest
}: AppTextareaProps) {
  return (
    <AppField
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      {(fieldProps) => (
        <textarea
          {...rest}
          {...fieldProps}
          className={`${fieldClasses} resize-none ${error ? 'border-danger' : ''} ${className}`}
        />
      )}
    </AppField>
  );
}

type AppSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  fieldClassName?: string;
};

export function AppSelect({
  label,
  hint,
  error,
  required,
  fieldClassName,
  className = '',
  children,
  ...rest
}: AppSelectProps) {
  return (
    <AppField
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      {(fieldProps) => (
        <select
          {...rest}
          {...fieldProps}
          className={`${fieldClasses} appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${error ? 'border-danger' : ''} ${className}`}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280' stroke-width='2'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' d='m19.5 8.25-7.5 7.5-7.5-7.5'/%3e%3c/svg%3e\")",
          }}
        >
          {children}
        </select>
      )}
    </AppField>
  );
}
