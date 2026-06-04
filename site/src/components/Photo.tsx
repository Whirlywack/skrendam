/**
 * Photo — warm scene wrapper (.yip-photo treatment).
 *
 * Renders a positioned div with the scene gradient class + the chosen
 * treatment modifier.  When `src` is provided an <img> is slotted inside
 * (the CSS sizes it to 100%/cover via .yip-photo > img).  Children are
 * layered on top (z-index comes from the treatment ::after pseudo-element
 * sitting at z-index 2, so slot content should be z-index ≥ 3 or use
 * position:absolute as the deal/feat overlays do).
 *
 * className is appended AFTER the yip-photo classes so callers can add
 * layout helpers such as "ph" (used by .deal/.feat) without losing the
 * treatment modifier.
 */
export function Photo({
  scene,
  src,
  treatment = 'protect',
  className = '',
  children,
}: {
  scene: string;
  src?: string;
  treatment?: 'protect' | 'duotone';
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`yip-photo yip-photo--${treatment} ${scene}${className ? ` ${className}` : ''}`}>
      {src && <img src={src} alt="" loading="lazy" />}
      {children}
    </div>
  );
}
