export const fields = {
  age: { label: "Age", unit: "years" },
  trestbps: { label: "Resting blood pressure", unit: "mmHg" },
  chol: { label: "Serum cholesterol", unit: "mg/dL" },
  thalach: { label: "Peak heart rate", unit: "beats/min" },
  oldpeak: { label: "Exercise ST depression", unit: "relative to rest", decimal: true },
  sex: { label: "Sex as recorded", options: { 0: "0 · Female", 1: "1 · Male" } },
  cp: { label: "Chest pain type", hint: "Chest pain categories from the study CSV." },
  fbs: { label: "Fasting blood sugar >120 mg/dL", options: { 0: "0 · No", 1: "1 · Yes" } },
  restecg: { label: "Resting ECG result", hint: "Resting ECG categories from the study CSV." },
  exang: { label: "Exercise-induced angina", options: { 0: "0 · No", 1: "1 · Yes" } },
  slope: { label: "Peak-exercise ST slope", hint: "ST slope categories from the study CSV." },
  ca: { label: "Major vessel code", hint: "Vessel count feature as encoded in the study CSV." },
  thal: { label: "Thallium stress test result", hint: "Stress-test categories from the study CSV." },
  target: { label: "Dataset label" },
};

export const examples = [
  { age: 48, trestbps: 121, chol: 199, thalach: 172, oldpeak: 0.3, sex: 0, cp: 2, fbs: 0, restecg: 1, exang: 0, slope: 2, ca: 0, thal: 2 },
  { age: 61, trestbps: 156, chol: 274, thalach: 115, oldpeak: 2.7, sex: 1, cp: 0, fbs: 1, restecg: 0, exang: 1, slope: 0, ca: 2, thal: 3 },
];

export function featureLabel(encoded) {
  const [group, key, value] = encoded.split(/__|_/);
  const label = fields[key].label;
  return group === "cat" ? label + " (" + value + ")" : label;
}

export function predict(model, values) {
  let logit = model.intercept;
  const contributions = [];
  for (const { key, center, scale, min, max, coefficient, reference } of model.numeric) {
    const value = values[key];
    if (!Number.isFinite(value) || value < min || value > max ||
        (!fields[key].decimal && !Number.isInteger(value))) {
      throw new RangeError("Enter a valid value for " + fields[key].label + ".");
    }
    const standardized = (value - center) / scale;
    logit += standardized * coefficient;
    contributions.push({ key, impact: (standardized - reference) * coefficient });
  }
  for (const { key, levels } of model.categorical) {
    if (!levels.some(level => level.value === values[key])) {
      throw new RangeError("Choose a valid code for " + fields[key].label + ".");
    }
    let impact = 0;
    for (const { value, reference, coefficient } of levels) {
      const active = Number(value === values[key]);
      logit += active * coefficient;
      impact += (active - reference) * coefficient;
    }
    contributions.push({ key, impact });
  }
  return {
    score: 1 / (1 + Math.exp(-logit)),
    label: Number(logit > 0),
    logit,
    contributions: contributions.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
  };
}
