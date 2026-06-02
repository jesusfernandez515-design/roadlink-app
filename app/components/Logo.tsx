export default function Logo({ height = 120 }: { height?: number }) {
  return (
    <img
      src="/roadlink-logo.png"
      alt="RoadLink"
      style={{
        height: `${height}px`,
        width: "auto",
        display: "block",
        objectFit: "contain",
      }}
    />
  );
}
