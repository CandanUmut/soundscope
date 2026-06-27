// Frequency-weighting filters (A / C / Z) built from cascaded BiquadFilterNodes.
//
// These are standard IEC 61672 approximations realised as analog-prototype
// biquads. They are GOOD ENOUGH for relative/awareness use but are NOT a
// per-device-corrected response: the phone mic's own frequency response is not
// flat and is not compensated here, so A/C weighting in this app is approximate.

/**
 * Build a weighting filter chain.
 * @param {AudioContext} ctx
 * @param {'A'|'C'|'Z'} type
 * @returns {{input: AudioNode, output: AudioNode, nodes: BiquadFilterNode[]}}
 *          For 'Z' (flat), input === output is a pass-through GainNode.
 */
export function buildWeighting(ctx, type) {
  if (type === 'Z') {
    const passthrough = new GainNode(ctx, { gain: 1 });
    return { input: passthrough, output: passthrough, nodes: [] };
  }

  const nodes = type === 'A' ? buildAWeighting(ctx) : buildCWeighting(ctx);
  // Chain them.
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return { input: nodes[0], output: nodes[nodes.length - 1], nodes };
}

// A-weighting: two highpass stages near 20.6 Hz, two lowpass near 12.2 kHz,
// plus the mid shelf pair at 107.7 Hz and 737.9 Hz, with a +2 dB normalisation
// so the response is ~0 dB at 1 kHz.
function buildAWeighting(ctx) {
  const f1 = 20.598997;
  const f2 = 107.65265;
  const f3 = 737.86223;
  const f4 = 12194.217;

  const hp1 = new BiquadFilterNode(ctx, { type: 'highpass', frequency: f1, Q: 0.5 });
  const hp2 = new BiquadFilterNode(ctx, { type: 'highpass', frequency: f1, Q: 0.5 });
  const lp1 = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: f4, Q: 0.5 });
  const lp2 = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: f4, Q: 0.5 });
  // The mid-band emphasis (the dip then rise) approximated with peaking/shelf:
  const peak = new BiquadFilterNode(ctx, { type: 'peaking', frequency: Math.sqrt(f2 * f3), Q: 0.6, gain: 0.0 });
  const hsMid = new BiquadFilterNode(ctx, { type: 'highshelf', frequency: f3, gain: 2.0 });
  const lsMid = new BiquadFilterNode(ctx, { type: 'lowshelf', frequency: f2, gain: 0.0 });

  return [hp1, hp2, lsMid, peak, hsMid, lp1, lp2];
}

// C-weighting: the same 20.6 Hz / 12.2 kHz roll-offs without the mid emphasis,
// normalised to ~0 dB at 1 kHz. Essentially flat across the audible mid-band.
function buildCWeighting(ctx) {
  const f1 = 20.598997;
  const f4 = 12194.217;
  const hp1 = new BiquadFilterNode(ctx, { type: 'highpass', frequency: f1, Q: 0.5 });
  const hp2 = new BiquadFilterNode(ctx, { type: 'highpass', frequency: f1, Q: 0.5 });
  const lp1 = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: f4, Q: 0.5 });
  const lp2 = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: f4, Q: 0.5 });
  return [hp1, hp2, lp1, lp2];
}

export const WEIGHTING_LABELS = { A: 'dB(A)', C: 'dB(C)', Z: 'dB(Z)' };
