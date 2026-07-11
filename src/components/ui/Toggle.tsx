
interface ToggleProps {
  active: boolean;
  onClick: () => void;
  className?: string;
}

export function Toggle({ active, onClick, className = '' }: ToggleProps) {
  return (
    <div className={`toggle ${active ? "active" : ""} ${className}`} onClick={onClick}>
      <div className="toggle-knob" />
    </div>
  );
}
