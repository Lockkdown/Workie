/** English strings Workie owns instead of the browser [D78] [D104]. Editable copy. */
export const COPY = {
  valueMissing: "This field is required.",
  rangeUnderflow: (min: string) => `Enter a value of at least ${min}.`,
  rangeOverflow: (max: string) => `Enter a value of at most ${max}.`,
  stepMismatch: (step: string) => `Enter a value in steps of ${step}.`,
  badInput: "Enter a valid number.",
  chooseFile: "Choose file",
  noFileSelected: "No file selected.",
} as const;
