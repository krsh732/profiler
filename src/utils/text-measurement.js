/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @flow

/**
 * Measure the size of text for drawing within a 2d context. This will allow text
 * to be drawn in a constrained space. This class uses a variety of heuristics and
 * caching to make this process fast.
 */
class TextMeasurement {
  _ctx: CanvasRenderingContext2D;
  _cache: { [id: string]: number };
  overflowChar: string;
  minWidth: number;

  constructor(ctx: CanvasRenderingContext2D) {
    this._ctx = ctx;
    this._cache = {};

    // TODO - L10N
    this.overflowChar = '…';
    this.minWidth = this.getTextWidth(this.overflowChar);

    this._preCalcCharWidths();
  }

  /**
   * Fills the cache with printable ASCII character widths to help speed things up.
   */
  _preCalcCharWidths() {
    for (let i = 32; i < 128; i++) {
      this.getTextWidth(String.fromCharCode(i));
    }
  }

  /**
   * Gets the width of the specified text, for the current context state
   * (font size, family etc.).
   *
   * @param {string} text - The text to analyze.
   * @return {number} The text width.
   */
  getTextWidth(text: string): number {
    const cachedWidth = this._cache[text];
    if (cachedWidth !== undefined) {
      return cachedWidth;
    }
    const metrics = this._ctx.measureText(text);
    this._cache[text] = metrics.width;
    return metrics.width;
  }

  /**
   * Massage a text to fit inside a given width. This clamps the string
   * at the end to avoid overflowing.
   *
   * @param {string} text -The text to fit inside the given width.
   * @param {number} maxWidth - The available width for the given text.
   * @return {string} The fitted text.
   */
  getFittedText(text: string, maxWidth: number): string {
    if (this.getTextWidth(text) < maxWidth) {
      return text;
    }

    // Save space for the overflow character at the end.
    let estimatedRemainingWidth = maxWidth - this.minWidth;

    // Since `ctx.measureText` is expensive and cache footprint would increase
    // if we cache all intermediate attempts, approximate the truncation point
    // using individual character widths instead. Aside from differences arising
    // from kerning, summing individual character widths should be a good estimator.
    let n;
    for (n = 0; n < text.length - 1; n++) {
      estimatedRemainingWidth -= this.getTextWidth(text[n]);
      if (estimatedRemainingWidth < 0) {
        break;
      }
    }

    // Visually, under-draws are more tolerable than over-draws.
    // Thus, we continue refining the truncation point if there is an over-draw.
    // The hope here is that there won't be many iterations of corrections, since:
    // - Text is most likely ASCII only.
    // - Fonts usually don't have positive kerning values for ASCII pairs.

    // TODO: this is ugly
    let fittedWidth = NaN;
    while (
      n > 0 &&
      (fittedWidth = this._ctx.measureText(
        text.substring(0, n) + this.overflowChar
      ).width) > maxWidth
    ) {
      while (n > 0 && fittedWidth > maxWidth) {
        fittedWidth -= this.getTextWidth(text[--n]);
      }
    }

    // TODO: somehow salvage under-draws? A pathological "AVAVAV..." really looks bad.

    return n > 0 ? text.substring(0, n) + this.overflowChar : '';
  }
}

export default TextMeasurement;
