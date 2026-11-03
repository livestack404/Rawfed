export interface LearnStep {
  part: 1 | 2 | 3;
  step: number;
  shortLabel: string;
  caption: string;
  confusionBox?: string;
}

export const PART_1_STEPS: LearnStep[] = [
  {
    part: 1,
    step: 1,
    shortLabel: 'The problem',
    caption: 'Each hospital holds private chest X-rays. Privacy rules mean the images cannot leave the hospital.',
  },
  {
    part: 1,
    step: 2,
    shortLabel: 'Old vs new',
    caption: "The old way, collecting everyone's images in one place, is not allowed. In federated learning the images stay where they are.",
  },
  {
    part: 1,
    step: 3,
    shortLabel: 'Blank model',
    caption: 'The central server starts with an untrained model, like a blank notebook.',
  },
  {
    part: 1,
    step: 4,
    shortLabel: 'Send',
    caption: 'Step 1 of every round: the server sends a copy of the current model to every hospital.',
  },
  {
    part: 1,
    step: 5,
    shortLabel: 'Train',
    caption: 'Step 2: each hospital trains its copy on its own X-rays. The images never leave.',
  },
  {
    part: 1,
    step: 6,
    shortLabel: 'Send back',
    caption: 'Step 3: each hospital sends back only what it learned, a small list of changes. No images are sent.',
  },
  {
    part: 1,
    step: 7,
    shortLabel: 'Combine',
    caption: 'Steps 4 and 5: the server checks the updates and averages the good ones into one better model.',
  },
  {
    part: 1,
    step: 8,
    shortLabel: 'Repeat',
    caption: 'Repeat. Round 2 starts from the improved model. After many rounds the shared model has learned from every hospital without seeing a single X-ray.',
    confusionBox: 'Is this ensemble learning? No. An ensemble is many separate models whose answers are combined. Here there is one shared model that every hospital helps train.',
  },
];

export const PART_2_STEPS: LearnStep[] = [
  {
    part: 2,
    step: 1,
    shortLabel: 'Setup',
    caption: 'Now suppose 2 of the 8 hospitals are secretly compromised. The server does not know which.',
  },
  {
    part: 2,
    step: 2,
    shortLabel: 'Flip labels',
    caption: 'They train on flipped labels: Normal X-rays marked as Pneumonia, and the other way round.',
  },
  {
    part: 2,
    step: 3,
    shortLabel: 'Updates arrive',
    caption: 'Their updates arrive looking like any other. The server compares every update with the group.',
  },
  {
    part: 2,
    step: 4,
    shortLabel: 'Compare',
    caption: 'Most updates point the same way. The poisoned ones point the opposite way, so they stand out.',
  },
  {
    part: 2,
    step: 5,
    shortLabel: 'Reject',
    caption: 'Rejected updates are not used. A hospital that keeps getting rejected loses trust and is excluded.',
  },
  {
    part: 2,
    step: 6,
    shortLabel: 'Result',
    caption: 'With protection the model stays accurate. Without it, the poisoned updates drag accuracy down. See it live on the Simulation page.',
  },
];

export const PART_3_STEPS: LearnStep[] = [
  {
    part: 3,
    step: 1,
    shortLabel: 'Record',
    caption: 'Every decision (accepted, rejected, excluded) is saved as a record.',
  },
  {
    part: 3,
    step: 2,
    shortLabel: 'Fingerprint',
    caption: 'A fingerprint of each record is written to the blockchain, which cannot be edited.',
  },
  {
    part: 3,
    step: 3,
    shortLabel: 'Verify',
    caption: 'If someone edits a saved record, its fingerprint no longer matches the chain and Verify catches it.',
  },
];

export const ALL_LEARN_STEPS: Record<number, LearnStep[]> = {
  1: PART_1_STEPS,
  2: PART_2_STEPS,
  3: PART_3_STEPS,
};
