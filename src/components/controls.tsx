import type { ComponentProps } from "react";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} data-slot="input" />;
}
export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} />;
}
export function Button(props: ComponentProps<"button">) {
  return <button {...props} />;
}
/** Native keyboard-accessible choices, packaged and styled entirely by the plugin. */
export function Select({
  options,
  onValueChange,
  ...props
}: Omit<ComponentProps<"select">, "onChange"> & {
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
}) {
  return (
    <select
      {...props}
      data-slot="select-trigger"
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
