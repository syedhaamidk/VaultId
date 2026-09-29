import { forwardRef } from "react";

/* Button — variants mirror the kit: primary | secondary | ghost | danger, sizes sm. */
const Button = forwardRef(function Button(
  { variant = "secondary", size, disabled, className = "", children, ...rest },
  ref
) {
  const cls = ["btn", `btn-${variant}`, size === "sm" && "btn-sm", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} className={cls} disabled={disabled} {...rest}>
      {children}
    </button>
  );
});

export default Button;
