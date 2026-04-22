"use client";

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Check as CheckIcon, ChevronDown } from "lucide-react";

function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/*  Input / Textarea / Select                                                  */
/* -------------------------------------------------------------------------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn("field-input", className)} {...rest} />;
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn("field-textarea", className)} {...rest} />;
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn("field-select", className)} {...rest}>
      {children}
    </select>
  );
});

/* -------------------------------------------------------------------------- */
/*  Dropdown (custom, matches field styling)                                   */
/* -------------------------------------------------------------------------- */

export interface DropdownOption<V extends string = string> {
  value: V;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}

export interface DropdownProps<V extends string = string> {
  value: V | "";
  onChange: (v: V) => void;
  options: DropdownOption<V>[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function Dropdown<V extends string = string>({
  value,
  onChange,
  options,
  placeholder = "— select —",
  id,
  disabled,
  className,
  ...rest
}: DropdownProps<V>) {
  const autoId = useId();
  const buttonId = id ?? autoId;
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value && !o.disabled)
    )
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${activeIdx}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);

  function move(delta: number) {
    if (options.length === 0) return;
    let next = activeIdx;
    for (let i = 0; i < options.length; i++) {
      next = (next + delta + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    setActiveIdx(next);
  }

  function onButtonKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        const o = options[activeIdx];
        if (o && !o.disabled) {
          onChange(o.value);
          setOpen(false);
        }
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      for (let i = 0; i < options.length; i++) {
        if (!options[i].disabled) {
          setActiveIdx(i);
          break;
        }
      }
    } else if (e.key === "End") {
      e.preventDefault();
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i].disabled) {
          setActiveIdx(i);
          break;
        }
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
    >
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
        className={cn(
          "field-input flex w-full items-center justify-between gap-2 text-left",
          disabled && "opacity-60 cursor-not-allowed"
        )}
        {...rest}
      >
        <span className={cn(selected ? "text-[#1C1C1C]" : "text-[#9CA3AF]", "truncate")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[#6B7280] transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-labelledby={buttonId}
          className="absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-[#D9DFDA] bg-white py-1 shadow-lg"
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-[#6B7280]">No options</li>
          )}
          {options.map((o, i) => {
            const isSelected = o.value === value;
            const isActive = i === activeIdx;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={o.disabled || undefined}
                data-idx={i}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (o.disabled) return;
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-start gap-2 px-3 py-2 text-sm",
                  o.disabled
                    ? "cursor-not-allowed text-[#9CA3AF]"
                    : "cursor-pointer text-[#1C1C1C]",
                  !o.disabled && isActive && "bg-[#F7F9F7]",
                  isSelected && "bg-[#DCE8E4]"
                )}
              >
                <CheckIcon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isSelected ? "text-[#244943]" : "opacity-0"
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{o.label}</span>
                  {o.hint && (
                    <span className="mt-0.5 block truncate text-xs text-[#6B7280]">
                      {o.hint}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Label / Helper / SectionHeader                                             */
/* -------------------------------------------------------------------------- */

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  label: ReactNode;
  helper?: ReactNode;
  required?: boolean;
}

export function Label({ label, helper, required, className, children, ...rest }: LabelProps) {
  return (
    <label className={cn("block", className)} {...rest}>
      <span className="t-label mb-1.5 block">
        {label}
        {required && <span className="ml-0.5 text-[#B85C5C]">*</span>}
      </span>
      {children}
      {helper && <Helper className="mt-1.5">{helper}</Helper>}
    </label>
  );
}

export function Helper({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("t-helper", className)}>{children}</p>;
}

export function SectionHeader({
  title,
  description,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3", className)}>
      <h3 className="t-section">{title}</h3>
      {description && <p className="t-helper mt-0.5">{description}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Card                                                                       */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  size = "md",
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  as?: "div" | "section" | "article";
}) {
  const padding =
    size === "sm" ? "p-4" : size === "lg" ? "p-8" : "p-6";
  return (
    <As
      className={cn(
        "rounded-2xl border border-[#D9DFDA] bg-white",
        padding,
        className
      )}
    >
      {children}
    </As>
  );
}

/* -------------------------------------------------------------------------- */
/*  Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#1C1C1C] text-white hover:bg-[#1D3931] active:bg-[#2A3F2F] focus-visible:ring-[#2F5D54]",
  secondary:
    "border border-[#D9DFDA] bg-white text-[#1C1C1C] hover:bg-[#F7F9F7] focus-visible:ring-[#2F5D54]",
  ghost:
    "text-[#1C1C1C] hover:bg-[#F7F9F7] focus-visible:ring-[#2F5D54]",
  danger:
    "border border-[#F4C6C6] bg-white text-[#991B1B] hover:bg-[#FEE2E2] focus-visible:ring-[#B85C5C]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", leftIcon, rightIcon, className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
});

/* -------------------------------------------------------------------------- */
/*  Badge                                                                      */
/* -------------------------------------------------------------------------- */

export type BadgeTone = "sage" | "blue" | "amber" | "gray" | "danger";

const toneStyles: Record<BadgeTone, string> = {
  sage: "bg-[#DCE8E4] text-[#1D3931] border-[#BFD0C8]",
  blue: "bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]",
  amber: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]",
  gray: "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]",
  danger: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
};

export function Badge({
  tone = "gray",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneStyles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Divider                                                                    */
/* -------------------------------------------------------------------------- */

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-t border-[#E8ECE8]", className)} />;
}

/* -------------------------------------------------------------------------- */
/*  Tabs                                                                       */
/* -------------------------------------------------------------------------- */

export interface TabDef<V extends string = string> {
  value: V;
  label: ReactNode;
  hint?: ReactNode;
}

export function Tabs<V extends string = string>({
  value,
  onChange,
  tabs,
  className,
}: {
  value: V;
  onChange: (v: V) => void;
  tabs: TabDef<V>[];
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-[#E8ECE8] px-6",
        className
      )}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative -mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2",
              active
                ? "border-[#244943] text-[#1C1C1C]"
                : "border-transparent text-[#6B7280] hover:text-[#1C1C1C]"
            )}
          >
            {t.label}
            {t.hint}
          </button>
        );
      })}
    </div>
  );
}
