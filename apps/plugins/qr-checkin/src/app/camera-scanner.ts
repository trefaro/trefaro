/** What `jsqr` hands back for a frame it could read. */
type Decoder = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: 'dontInvert' },
) => { data: string } | null;

/** How often a frame is looked at. Six times a second is faster than a hand. */
const FRAME_INTERVAL_MS = 160;

/** Wider than this is decoded no better, only slower. */
const MAX_FRAME_WIDTH = 640;

/** The same code is not sent again inside this window. */
const REPEAT_SILENCE_MS = 3000;

/**
 * Whether this browser offers a camera at all.
 *
 * Asked before a button is drawn, not after it is pressed: a door running on a
 * desktop without a camera, or on a page served over plain HTTP where
 * `mediaDevices` does not exist, gets the field and the list and no button
 * that can only apologize (F199).
 */
export function cameraAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

/**
 * The camera half of the door (FR 3.16, F199).
 *
 * A frame every {@link FRAME_INTERVAL_MS} onto a canvas, `jsQR` over its
 * pixels, and the decoded text handed on. **`jsqr` is Apache-2.0** — compatible
 * with AGPL-3.0-or-later — **zero dependencies, and it ships in this bundle**:
 * the two criteria the plan set for this decision. Nothing is fetched from a
 * network, and no picture leaves the browser; the decoding happens on the
 * device holding the camera, which is also what keeps a hall full of faces out
 * of anybody's server (NFR 9).
 *
 * **Loaded when the camera is switched on, not when the bundle is.** The
 * decoder is a third of this bundle's weight, and the half of it that a
 * participant loads — a ticket on a phone, mobile first — has no use for one:
 * it *draws* codes, it does not read them. A dynamic import puts it in its own
 * chunk beside `main.js`, which the server hands out of the same directory.
 *
 * **This class is the half no suite of this repository can prove.** A camera
 * needs a device, so it gets a line in the device matrix of `todo.md` — and
 * that is precisely why the door does not depend on it: the field beside it and
 * the button in every row of the list reach the same route with the same code.
 *
 * The same code is not resent for {@link REPEAT_SILENCE_MS}. A ticket held in
 * front of a lens decodes on every frame, and the door already answers 200 to a
 * second scan (E53) — the silence is about not asking a server sixty times for
 * an answer somebody is still reading.
 */
export class CameraScanner {
  private decode: Decoder | null = null;
  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private lastCode = '';
  private lastAt = 0;

  /**
   * Opens the camera and starts looking at frames.
   *
   * The rear camera is asked for, not demanded: `facingMode` is a preference,
   * and a laptop with one lens hands over the one it has rather than refusing.
   *
   * @throws whatever `getUserMedia` throws — no camera, no permission, no
   * secure context. The caller draws that as a sentence, not as a broken page.
   */
  async start(
    video: HTMLVideoElement,
    onCode: (code: string) => void,
  ): Promise<void> {
    this.stop();
    // Before the camera is asked for: a decoder that failed to arrive should
    // read as "no camera here" rather than as a lamp that came on for nothing.
    this.decode ??= (await import('jsqr')).default as unknown as Decoder;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    video.srcObject = this.stream;
    // Muted and inline, or a phone browser opens it full screen and the person
    // at the door loses the list behind it.
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    await video.play();
    this.tick(video, onCode);
  }

  /**
   * Gives the camera back.
   *
   * Every track, and the element's source too: a stream left running keeps the
   * lamp beside the lens on, which is the one hardware signal a person has that
   * a browser is watching them.
   */
  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const track of this.stream?.getTracks() ?? []) {
      track.stop();
    }
    this.stream = null;
    this.canvas = null;
    this.lastCode = '';
  }

  private tick(video: HTMLVideoElement, onCode: (code: string) => void): void {
    this.timer = setTimeout(() => {
      const found = this.read(video);
      if (found) onCode(found);
      // Rescheduled after the read, not alongside it: a slow frame must not
      // pile another one on top of itself.
      if (this.stream) this.tick(video, onCode);
    }, FRAME_INTERVAL_MS);
  }

  /** One frame, or `''` while there is nothing to read. */
  private read(video: HTMLVideoElement): string {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return '';

    const scale = Math.min(1, MAX_FRAME_WIDTH / width);
    const canvas = (this.canvas ??= document.createElement('canvas'));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return '';

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = this.decode?.(frame.data, canvas.width, canvas.height, {
      // A ticket is dark on light. Trying the inverse as well doubles the work
      // of every frame that contains nothing.
      inversionAttempts: 'dontInvert',
    });

    const code = result?.data.trim() ?? '';
    if (!code) return '';

    const now = Date.now();
    if (code === this.lastCode && now - this.lastAt < REPEAT_SILENCE_MS) {
      return '';
    }
    this.lastCode = code;
    this.lastAt = now;
    return code;
  }
}
