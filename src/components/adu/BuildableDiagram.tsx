import AduDisclaimer from "./AduDisclaimer";

interface Props {
  lotWidthFt: number | null;
  lotDepthFt: number | null;
  setbacks: { rear: number; sides: number; front: string };
  maxAduSqft: number | null;
}

/**
 * SVG-only buildable-zone diagram. Calculated from parcel dimensions —
 * no Mapbox/Google. If lot dimensions are missing, render text fallback.
 */
export default function BuildableDiagram({ lotWidthFt, lotDepthFt, setbacks, maxAduSqft }: Props) {
  const haveBoth = lotWidthFt != null && lotDepthFt != null;

  if (!haveBoth) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          <p className="font-medium">Diagram unavailable</p>
          <p className="mt-1 text-muted-foreground">
            Lot dimensions are not available from public parcel records for this property, so we
            can't render a buildable-zone diagram. Setback rules still apply: {setbacks.rear}ft rear,{" "}
            {setbacks.sides}ft sides, {setbacks.front.toLowerCase()}.
          </p>
        </div>
        <AduDisclaimer variant="diagram" />
      </div>
    );
  }

  // Layout maths — fit lot inside a 320×320 viewBox preserving aspect ratio.
  const VB = 320;
  const PAD = 24;
  const drawableW = VB - PAD * 2;
  const drawableH = VB - PAD * 2;
  const ratio = lotWidthFt! / lotDepthFt!;
  let lotPxW: number, lotPxH: number;
  if (ratio >= 1) {
    lotPxW = drawableW;
    lotPxH = drawableW / ratio;
  } else {
    lotPxH = drawableH;
    lotPxW = drawableH * ratio;
  }
  const lotX = (VB - lotPxW) / 2;
  const lotY = (VB - lotPxH) / 2;

  const scale = lotPxW / lotWidthFt!;
  const setbackPx = setbacks.sides * scale;
  const setbackRearPx = setbacks.rear * scale;
  // No-front placement → use a generous front buffer (10ft visual default).
  const setbackFrontPx = Math.min(setbackRearPx * 2.5, lotPxH * 0.35);

  const envX = lotX + setbackPx;
  const envY = lotY + setbackFrontPx;
  const envW = Math.max(lotPxW - setbackPx * 2, 0);
  const envH = Math.max(lotPxH - setbackFrontPx - setbackRearPx, 0);

  // Max ADU footprint — assume a roughly square footprint inside the envelope.
  let aduW = 0, aduH = 0, aduX = 0, aduY = 0;
  if (maxAduSqft && envW > 0 && envH > 0) {
    const sideFt = Math.sqrt(maxAduSqft);
    aduW = Math.min(sideFt * scale, envW * 0.85);
    aduH = Math.min(sideFt * scale, envH * 0.85);
    aduX = envX + (envW - aduW) / 2;
    aduY = envY + (envH - aduH) / 2;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-3">
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          role="img"
          aria-label="Buildable zone diagram"
          className="h-auto w-full"
        >
          {/* Lot boundary */}
          <rect
            x={lotX}
            y={lotY}
            width={lotPxW}
            height={lotPxH}
            fill="hsl(var(--background))"
            stroke="hsl(var(--foreground))"
            strokeWidth={2}
          />
          {/* Setback shaded ring */}
          <path
            d={`M${lotX},${lotY} h${lotPxW} v${lotPxH} h${-lotPxW} z M${envX},${envY} v${envH} h${envW} v${-envH} z`}
            fill="hsl(var(--muted))"
            fillOpacity={0.55}
            fillRule="evenodd"
          />
          {/* Buildable envelope */}
          {envW > 0 && envH > 0 ? (
            <rect x={envX} y={envY} width={envW} height={envH} fill="#F59E0B" fillOpacity={0.15} />
          ) : null}
          {/* Max ADU footprint */}
          {aduW > 0 && aduH > 0 ? (
            <rect
              x={aduX}
              y={aduY}
              width={aduW}
              height={aduH}
              fill="none"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          ) : null}

          {/* Labels */}
          <text x={VB / 2} y={lotY - 6} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
            {lotWidthFt}ft wide
          </text>
          <text
            x={lotX - 6}
            y={VB / 2}
            textAnchor="middle"
            fontSize={10}
            fill="hsl(var(--muted-foreground))"
            transform={`rotate(-90 ${lotX - 6} ${VB / 2})`}
          >
            {lotDepthFt}ft deep
          </text>
        </svg>
        <div className="mt-3 space-y-1.5 text-[12px] text-muted-foreground">
          <LegendDot color="hsl(var(--muted))" label="Setback zone — cannot build here" opacity={0.55} />
          <LegendDot color="#F59E0B" opacity={0.15} label="Your buildable area" />
          <LegendDot color="#F59E0B" label={`Max ADU footprint${maxAduSqft ? ` — ${maxAduSqft} sqft` : ""}`} dashed />
        </div>
      </div>
      <AduDisclaimer variant="diagram" />
    </div>
  );
}

function LegendDot({
  color,
  label,
  opacity = 1,
  dashed = false,
}: {
  color: string;
  label: string;
  opacity?: number;
  dashed?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-sm"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          opacity,
          border: dashed ? `1.5px dashed ${color}` : undefined,
        }}
      />
      <span>{label}</span>
    </div>
  );
}
