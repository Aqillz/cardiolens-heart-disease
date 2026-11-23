import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { examples, featureLabel, predict } from "../dist/model.js";
import { getAnswer } from "../dist/guide.js";

function readArtifact(name) {
  return JSON.parse(readFileSync(new URL("../dist/data/" + name + ".json", import.meta.url)));
}

const model = readArtifact("model");
const study = readArtifact("study");

test("fictional profiles match the fitted scikit-learn scores and classes", () => {
  const expected = [
    { score: 0.9926082839895405, label: 1 },
    { score: 0.007030568619927895, label: 0 },
  ];
  examples.forEach((profile, index) => {
    const result = predict(model, profile);
    assert.ok(Math.abs(result.score - expected[index].score) < 1e-12);
    assert.equal(result.label, expected[index].label);
  });
});

test("the grouped contributions sum to the log-odds difference", () => {
  for (const profile of examples) {
    const { logit, contributions } = predict(model, profile);
    const sum = contributions.reduce((total, { impact }) => total + impact, 0);
    assert.equal(contributions.length, 13);
    assert.ok(Math.abs(model.referenceLogit + sum - logit) < 1e-12);
  }
});

test("invalid or missing feature values are rejected", () => {
  for (const invalid of [{ age: 17 }, { age: 34.5 }, { cp: 100 }, { chol: NaN }, { oldpeak: Infinity }, { ca: undefined }]) {
    assert.throws(() => predict(model, { ...examples[0], ...invalid }), RangeError);
  }
  assert.doesNotThrow(() => predict(model, { ...examples[0], oldpeak: 0.35 }));
});

test("the published test outcomes and their denominators agree", () => {
  const { dataset, models, shap, exploration } = study;
  assert.equal(dataset.train + dataset.test, dataset.clean);
  assert.equal(dataset.negative + dataset.positive, dataset.clean);
  assert.equal(models.length, 5);
  assert.equal(models[0].name, "Logistic regression");
  assert.ok(Math.abs(models[0].test.accuracy - 52 / 61) < 1e-12);
  for (const model of models) {
    const [[tn, fp], [fn, tp]] = model.confusion;
    assert.equal(tn + fp + fn + tp, dataset.test);
    assert.ok(Math.abs((tn + tp) / dataset.test - model.test.accuracy) < 1e-12);
    assert.equal(model.cv.folds.length, 5);
    assert.deepEqual(model.roc[0], [0, 0]);
    assert.deepEqual(model.roc.at(-1), [1, 1]);
  }
  assert.equal(shap.importance.length, 30);
  assert.ok(shap.dependence.bins.every(bin => bin.count >= 5));
  assert.ok(Object.values(exploration.patterns).flat().every(group => group.negative >= 5 && group.positive >= 5));
});

test("the assistant links to study factors and sourced health topics", () => {
  const factor = getAnswer("What factors determine the prediction?", study);
  assert.match(factor.text, new RegExp(featureLabel(study.shap.importance[0].feature).split(" (")[0]));
  assert.deepEqual(factor.link.slice(1), ["#results", "explain"]);
  assert.match(getAnswer("What food is suitable?", study).link[1], /heart\.org/);
  assert.match(getAnswer("What activity routine works?", study).text, /150 minutes/);
  assert.match(getAnswer("How can adults lower risk of heart disease?", study).link[1], /cdc\.gov/);
  assert.match(getAnswer("What does my score mean?", study).text, /positive label/);
  assert.match(getAnswer("I have chest pain and can't breathe", study).text, /emergency services/);
  assert.match(getAnswer("Which medication dosage should I use?", study).text, /clinician or pharmacist/);
  assert.match(getAnswer("What is the weather?", study).text, /Try asking/);
});
