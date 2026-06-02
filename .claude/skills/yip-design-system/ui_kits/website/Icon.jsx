// Shared Icon component (Lucide). Renders SVG imperatively so React reconciliation
// never fights lucide's node replacement. Export to window for cross-file use.
function Icon({ name, size = 18, color, strokeWidth = 2, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = `<i data-lucide="${name}"></i>`;
    window.lucide.createIcons();
    const svg = el.querySelector("svg");
    if (svg) {
      svg.setAttribute("width", size);
      svg.setAttribute("height", size);
      svg.setAttribute("stroke-width", strokeWidth);
    }
  }, [name, size, strokeWidth]);
  return (
    <span
      ref={ref}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, color, flex: "none", ...style }}
    />
  );
}

// Yip wordmark lockup (dotless ı + amber bead tittle)
function Wordmark({ size = 30, light = false }) {
  return (
    <span
      className="yip-logo"
      style={{ fontSize: size, "--logo-ink": light ? "#FBF6EC" : "#1C1813" }}
    >
      yıp
    </span>
  );
}

Object.assign(window, { Icon, Wordmark });
