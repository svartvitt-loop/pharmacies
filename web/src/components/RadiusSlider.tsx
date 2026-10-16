import { useId } from "react";
import { RADII_KM } from "../filter";
import { useI18n } from "../i18n";

interface Props {
  radiusKm: number;
  onChange: (radiusKm: number) => void;
}

/** A slider over the fixed radii, with each step labelled underneath. */
export function RadiusSlider({ radiusKm, onChange }: Props) {
  const { t } = useI18n();
  const id = useId();
  const index = Math.max(0, RADII_KM.indexOf(radiusKm as (typeof RADII_KM)[number]));
  return (
    <div className="radius">
      <label htmlFor={id}>{t("radius")}</label>
      <div className="radius-slider">
        <input
          id={id}
          type="range"
          min={0}
          max={RADII_KM.length - 1}
          step={1}
          value={index}
          aria-valuetext={`${radiusKm} km`}
          onChange={(e) => onChange(RADII_KM[Number(e.target.value)])}
        />
        <div className="radius-ticks" aria-hidden="true">
          {RADII_KM.map((km) => (
            <span key={km} className={km === radiusKm ? "current" : undefined}>
              {km} km
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
