import { ArrowUpRight } from "lucide-react";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <ArrowUpRight size={25} strokeWidth={2.8} />
      </span>
      relay<span className="brand-period">.</span>
    </span>
  );
}
