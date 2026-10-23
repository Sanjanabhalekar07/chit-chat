type AvatarProps = { name: string; small?: boolean };

export default function Avatar({ name, small = false }: AvatarProps) {
  const colors = ["#e7b7a4", "#b6c5a8", "#b9b5dc", "#dfc493", "#9ebdc4"];
  const hue = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length;

  return (
    <span className={`avatar${small ? " avatar-small" : ""}`} style={{ background: colors[hue] }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
