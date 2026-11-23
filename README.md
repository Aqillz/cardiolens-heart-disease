# CardioLens

CardioLens is a browser-based companion to a heart disease classification study. It compares five classifiers, explains the selected logistic regression model, and lets visitors run the published model on fictional clinical inputs.

**[Open the live demo](https://aqillz.github.io/cardiolens-heart-disease/)**

## What the site includes

- **Overview** with key statistics, test accuracy by model, and the top encoded features by SHAP magnitude.
- **Study results** with baseline and tuned metrics, ROC curves, confusion matrices, five-fold validation, best hyperparameters, dataset checks, and aggregate SHAP summaries.
- **Prediction lab** with 13 validated inputs, two fictional profiles, the class-1 model score, and the strongest feature contributions for each case.
- **Heart guide** with a curated, rule-based question assistant. It covers model factors, score interpretation, heart-healthy eating, activity, and prevention. Its general health answers link to the American Heart Association or CDC.

The site needs no account, API key, paid service, Python server, or browser extension. Predictions and chat run on the visitor's device. The project is for research and education. Use a qualified healthcare professional for individual health decisions.

## Study results

The working CSV contained 303 records with 13 input features and one binary target. After removing one duplicate, the study used 241 records for training and 61 for held-out testing. All figures below refer to tuned models evaluated on that same test split.

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
| --- | ---: | ---: | ---: | ---: | ---: |
| Logistic regression | 85.25% | 83.33% | 90.91% | 86.96% | 0.8972 |
| Support vector machine | 80.33% | 78.38% | 87.88% | 82.86% | 0.8972 |
| Random forest | 77.05% | 74.36% | 87.88% | 80.56% | 0.8929 |
| K-nearest neighbors | 77.05% | 74.36% | 87.88% | 80.56% | 0.8701 |
| Decision tree | 67.21% | 67.57% | 75.76% | 71.43% | 0.7771 |

Logistic regression achieved the highest held-out accuracy and a mean five-fold validation accuracy of 86.73%. Test accuracy on this small dataset is an experimental result. Refer to the [methodology and model card](docs/METHODOLOGY.md) for the evaluation limits.

## Run locally

With Python 3 installed, run this from the repository root and open `http://127.0.0.1:8000` in your browser.

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Run the automated tests with Node.js 24.

```sh
node --test tests/model.test.mjs
```

## Repository layout

| Path | Purpose |
| --- | --- |
| [dist/](dist/) | Complete static dashboard, model demo, assistant, and JSON exports |
| [research/export_study.py](research/export_study.py) | Reproduce the study and export browser-ready artifacts from an authorized local CSV |
| [tests/](tests/) | Model, input validation, data consistency, and assistant checks |
| [docs/METHODOLOGY.md](docs/METHODOLOGY.md) | Data, evaluation design, model card, and reproduction |
| [docs/PRIVACY.md](docs/PRIVACY.md) | Data handling on the site and in the public repository |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Free GitHub Pages hosting and release instructions |
