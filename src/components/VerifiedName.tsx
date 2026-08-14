import { BadgeCheck } from "lucide-react";

interface Props {
  name: string;
  official: boolean;
  as?: "h2" | "h3";
  id?: string;
}

export function VerifiedName({ name, official, as: Tag = "h3", id }: Props) {
  return (
    <Tag id={id}>
      <span className="pkg-title">{name}</span>
      {official && (
        <BadgeCheck
          className="verified-badge"
          size={Tag === "h2" ? 20 : 16}
          aria-label="Official Homebrew package"
        />
      )}
    </Tag>
  );
}
