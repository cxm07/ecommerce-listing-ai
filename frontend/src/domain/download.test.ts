import { describe, expect, it, vi } from 'vitest';

import { triggerBlobDownload } from './download';

describe('triggerBlobDownload', () => {
  it('keeps the download link attached until the browser receives the click', () => {
    const createObjectURL = vi.fn(() => 'blob:workbook');
    const revokeObjectURL = vi.fn();
    let linkWasAttached = false;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      linkWasAttached = document.body.contains(this);
    });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.useFakeTimers();

    triggerBlobDownload(new Blob(['xlsx']), 'listing.xlsx');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(linkWasAttached).toBe(true);
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:workbook');
    click.mockRestore();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
