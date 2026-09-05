export const pdfVerticalDistanceDown = (upperY: number, lowerY: number): number =>
  upperY - lowerY;

export const isPdfVisuallyBelow = (
  candidateY: number,
  referenceY: number,
  minimumDistance = 0,
  maximumDistance = Number.POSITIVE_INFINITY
): boolean => {
  const distance = pdfVerticalDistanceDown(referenceY, candidateY);
  return distance >= minimumDistance && distance <= maximumDistance;
};

export const isSamePdfVisualRow = (
  firstY: number,
  secondY: number,
  tolerance = 3
): boolean => Math.abs(firstY - secondY) <= tolerance;
