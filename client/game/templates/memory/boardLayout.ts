export interface BoardLayout {
  cardWidth: number;
  cardHeight: number;
  gap: number;
  originX: number;
  originY: number;
}

const CARD_ASPECT = 1.0; // height / width
const GAP_RATIO = 0.08;

/** Fits a rows x columns grid of equal cards inside the viewport, centred. */
export function computeBoardLayout(viewW: number, viewH: number, rows: number, columns: number, padding: number): BoardLayout {
  const availW = Math.max(1, viewW - padding * 2);
  const availH = Math.max(1, viewH - padding * 2);
  const byWidth = availW / (columns + (columns - 1) * GAP_RATIO);
  const byHeight = availH / ((rows + (rows - 1) * GAP_RATIO) * CARD_ASPECT);
  const cardWidth = Math.floor(Math.min(byWidth, byHeight));
  const cardHeight = Math.floor(cardWidth * CARD_ASPECT);
  const gap = Math.floor(cardWidth * GAP_RATIO);
  const gridW = columns * cardWidth + (columns - 1) * gap;
  const gridH = rows * cardHeight + (rows - 1) * gap;
  return {
    cardWidth,
    cardHeight,
    gap,
    originX: (viewW - gridW) / 2 + cardWidth / 2,
    originY: (viewH - gridH) / 2 + cardHeight / 2,
  };
}
