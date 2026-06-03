export function Wordmark({ size = 30, light = false }: { size?: number; light?: boolean }) {
  return (
    <span
      className="yip-logo"
      style={{
        fontSize: size,
        ['--logo-ink' as string]: light ? '#FBF6EC' : '#1C1813',
      }}
    >
      yıp
    </span>
  );
}
