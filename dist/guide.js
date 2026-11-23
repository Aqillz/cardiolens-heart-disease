import { featureLabel } from "./model.js";

const sources = {
  prevention: ["CDC · Heart disease prevention", "https://www.cdc.gov/heart-disease/prevention/index.html"],
  food: ["American Heart Association · How to eat better", "https://www.heart.org/en/healthy-living/healthy-lifestyle/lifes-essential-8/how-to-eat-better-fact-sheet/"],
  activity: ["American Heart Association · Physical activity guidelines", "https://www.heart.org/en/healthy-living/exercise-and-physical-activity/fitness-basics/aha-recs-for-physical-activity-in-adults"],
  emergency: ["American Heart Association · Heart attack warning signs", "https://www.heart.org/en/health-topics/heart-attack/warning-signs-of-a-heart-attack"],
};

const topics = [
  {
    match: /\b(food|diet|meal|eat|eating|nutrition|salt|sodium|snack|fish|dash|vegetable|breakfast|makan|pemakanan)\w*\b/i,
    text: "A heart-healthy eating pattern can include vegetables, fruit, whole grains, beans, unsalted nuts, and fish. Try oats with fruit or a meal with brown rice, vegetables, and beans or grilled fish. Choose lower-sodium options and limit foods high in saturated fat or added sugars. A clinician or dietitian can help adapt those choices to your needs.",
    link: sources.food,
  },
  {
    match: /\b(exercise|activity|active|walk|walking|workout|routine|fitness|sport|senaman|rutin)\w*\b/i,
    text: "Many adults can work gradually toward 150 minutes of moderate aerobic activity each week, such as brisk walking, plus muscle strengthening on at least two days. One example is a 30-minute walk on five days. Ask a clinician what activity is appropriate if you have a heart condition or symptoms.",
    link: sources.activity,
  },
  {
    match: /\b(prevent|overcome|reduce|lower|improve|habits|lifestyle|smok|blood pressure|cholesterol|diabet|risk factors|cegah)\w*\b/i,
    text: "Heart-health habits include avoiding tobacco, staying active, and eating a balanced diet. A healthcare professional can check your blood pressure, cholesterol, and blood sugar and help you manage your personal risk.",
    link: sources.prevention,
  },
];

export function getAnswer(question, study) {
  if (/\b(heart attack|chest (pain|pressure|tightness)|shortness of breath|can'?t breathe|sakit dada|sesak nafas|fainting)\b/i.test(question) &&
      !/\b(chest pain type|why (does|did) the model|model feature|dataset code)\b/i.test(question)) {
    return { text: "If you or someone nearby is experiencing chest pressure, trouble breathing, or possible heart attack symptoms, contact local emergency services now. The demo cannot assess symptoms.", link: sources.emergency };
  }
  if (/\b(medicine|medication|dose|dosage|cure|diagnos|treatment|treat|prescri)\w*\b/i.test(question)) {
    return { text: "A qualified healthcare professional can evaluate symptoms and decide whether testing or treatment is needed. Use the study for general education. Contact your clinician or pharmacist for medication questions.", link: sources.prevention };
  }
  if (/\b(factor|feature|shap|influenc|determine|contribut)\w*\b/i.test(question) &&
      /\b(model|prediction|shap|classif|score|dataset)\w*\b/i.test(question)) {
    const names = study?.shap.importance.slice(0, 3).map(row => featureLabel(row.feature)).join(", ");
    return {
      text: names
        ? "The highest-ranked encoded features in the study were " + names + ". Rankings summarize average SHAP magnitude across 50 held-out records. In the Prediction lab, the contribution list shows which inputs raised or lowered the score for a fictional case."
        : "The model considers 13 clinical features. Each input contributes to the model output. The Explainability tab shows the study's rankings, and the Prediction lab explains individual fictional cases.",
      link: ["See SHAP results", "#results", "explain"],
    };
  }
  if (/\b(accuracy|precis|roc|auc|recall|train|study|model comparison)\w*\b/i.test(question)) {
    return {
      text: "The study compared five models on 61 held-out records. Logistic regression had the highest accuracy. The results include baseline and tuned metrics, five-fold validation, and confusion matrices.",
      link: ["See study results", "#results", "performance"],
    };
  }
  const topic = topics.find(item => item.match.test(question));
  if (topic) return topic;
  if (/\b(score|result|high risk|low risk|label|predict|probability)\w*\b/i.test(question)) {
    return {
      text: "The displayed percentage is the logistic model's score for the study's positive label. The predicted label is based on a 0.5 decision threshold. This score has no clinical validation as an estimate of your personal risk.",
      link: ["Open the prediction lab", "#prediction"],
    };
  }
  return { text: "Try asking about prediction factors, what a score means, heart-healthy foods, an activity routine, or ways adults can lower their risk of heart disease." };
}
