export default function Logo({ height = 70 }: { height?: number }) {
  return (
    <img
      src="/roadlink-logo.png"
      alt="RoadLink"
      style={{
        height,
        width: "auto",
        display: "block",
        objectFit: "contain",
      }}
    />
  );
}
