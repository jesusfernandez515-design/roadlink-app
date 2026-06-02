export default function Logo({ height = 80 }) {
  return (
    <img
      src="/roadlink-logo.png"
      alt="RoadLink"
      style={{
        height: `${height}px`,
        width: "auto",
        display: "block"
      }}
    />
  );
}
