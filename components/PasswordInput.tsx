"use client";

import { forwardRef, useState } from "react";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  wrapperClassName?: string;
};

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput({
  wrapperClassName = "",
  className = "",
  disabled,
  ...props
}, ref) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={`vtdd-password-wrap ${wrapperClassName}`}>
      <input
        {...props}
        ref={ref}
        className={className}
        type={showPassword ? "text" : "password"}
        disabled={disabled}
      />

      <button
        type="button"
        className="vtdd-password-eye"
        onClick={() => setShowPassword((v) => !v)}
        disabled={disabled}
        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
      >
        {showPassword ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.3 3.7 3.7 2.3l18 18-1.4 1.4-3.1-3.1A11.5 11.5 0 0 1 12 20C6.5 20 2.2 16.4 1 12c.5-1.9 1.7-3.7 3.4-5.1L2.3 3.7Zm5.2 5.2A5 5 0 0 0 12 17a5 5 0 0 0 2.6-.7l-2-2A2.7 2.7 0 0 1 9.7 11.4l-2.2-2.5ZM12 4c5.5 0 9.8 3.6 11 8a10.9 10.9 0 0 1-3 4.7l-2.8-2.8A5 5 0 0 0 10.1 6.8L7.9 4.6A11.8 11.8 0 0 1 12 4Zm0 3a5 5 0 0 1 5 5c0 .5-.1 1-.2 1.5L14.9 11.6A3 3 0 0 0 12.4 9.1l-1.9-1.9c.5-.1 1-.2 1.5-.2Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4c5.5 0 9.8 3.6 11 8-.2.9-.7 1.9-1.3 2.8A11.6 11.6 0 0 1 12 20C6.5 20 2.2 16.4 1 12c1.2-4.4 5.5-8 11-8Zm0 2C7.7 6 4.3 8.6 3.1 12c1.2 3.4 4.6 6 8.9 6s7.7-2.6 8.9-6C19.7 8.6 16.3 6 12 6Zm0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
          </svg>
        )}
      </button>
    </div>
  );
});

export default PasswordInput;
