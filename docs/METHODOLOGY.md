# Methodology and model card

## Dataset

The experiment uses the project's local 303-row `heart.csv` with a 0/1 target. There were zero missing values and one exact duplicate. The 302 retained rows contain 138 negative labels and 164 positive labels. The recorded features are age, sex code, chest pain type, resting blood pressure, serum cholesterol, fasting blood sugar flag, resting ECG result, peak heart rate, exercise-induced angina, exercise ST depression, ST slope, major vessel code, and thallium stress-test code.

UCI describes the related Cleveland Heart Disease collection and its 13 input variables. The exact provenance, recoding, and category definitions for the working CSV are unverified. The study preserves the CSV labels and the demo displays ambiguous categories as numeric codes. [UCI Heart Disease dataset](https://archive.ics.uci.edu/dataset/45/heart+disease)

## Experimental design

1. Normalize column names and remove exact duplicate rows before splitting. Record missing values, range checks, and IQR outliers. Keep the records flagged during screening.
2. Make a stratified 80/20 train-test split using seed 42. The resulting sets have 241 training records and 61 held-out test records.
3. Fit standard scaling to five numeric features and one-hot encoding to eight categorical features inside each model pipeline. The transformations are fit within each training fold during tuning.
4. Fit default baselines and tune logistic regression, K-nearest neighbors, support vector machine, decision tree, and random forest using `GridSearchCV` with stratified five-fold cross-validation. Select each model's hyperparameters by mean validation accuracy.
5. Evaluate each tuned model on the held-out split. Use the classifier's default rule for accuracy, precision, recall, F1 and confusion counts. Use the positive-class score for ROC curves and ROC-AUC.

## Deployed model

The browser uses the fitted logistic regression model because it led test accuracy. The export contains the fitted numeric scaling, categorical levels, weights, intercept, and aggregated SHAP background. The browser reproduces the pipeline locally and displays the sigmoid of the log-odds as a class-1 score. The default class is 1 for log-odds above zero and 0 otherwise. Inputs are bounded by the observed data ranges and known levels. Range boundaries represent model support in this dataset and carry no clinical meaning.

Independent-background Linear SHAP calculates the difference from the 50-record training background mean multiplied by each encoded feature's coefficient. Global explanations summarize 50 held-out records. The local explanation groups one-hot contributions by their original field. Contributions across all 13 fields add to the difference between the case log-odds and the background log-odds. The site shows the five largest absolute contributions.

## Intended use and limits

- Demonstrate supervised classification, comparative metrics, and explainability to students and reviewers using fictional inputs.
- The study primarily reflects one small historical dataset. It lacks external validation, calibration for personal or future risk, and subgroup fairness analysis.
- Ranking models by the same test split can make the winner's result optimistic. Cross-validation figures are tuning scores and each model's best candidate was chosen from those folds.
- The model estimates a study label and has no defined prediction horizon. Clinical use would require appropriate data provenance, clinical validation, and governance.
- SHAP describes how the inputs affect this fitted model. Individual health effects and causation are outside the scope of the analysis.

## Reproduce the artifacts

Use your authorized copy of the original CSV. From the repository root, run the following with Python 3.12.

```sh
python -m venv .venv
```

Activate the environment with `.venv\Scripts\Activate.ps1` in PowerShell or `source .venv/bin/activate` in Bash, then run the export.

```sh
python -m pip install -r research/requirements.txt
python research/export_study.py /path/to/your/local/heart.csv
node --test tests/model.test.mjs
```

[The aggregate study artifact](../dist/data/study.json) records the input CSV's SHA-256 fingerprint and the scikit-learn version used for the export. The raw data and original notebook are excluded from the release. Regenerating with a different dataset can change the results, so update the HTML descriptions, documentation, and regression expectations when publishing a new study.
