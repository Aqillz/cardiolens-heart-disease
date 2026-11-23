"""Reproduce the notebook experiment and export only aggregate study artifacts."""

import argparse
import hashlib
import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, confusion_matrix, f1_score, precision_score, recall_score,
    roc_auc_score, roc_curve,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier


SEED = 42
NUMERIC = ["age", "trestbps", "chol", "thalach", "oldpeak"]
CATEGORICAL = ["sex", "cp", "fbs", "restecg", "exang", "slope", "ca", "thal"]
FEATURES = NUMERIC + CATEGORICAL
MODELS = {
    "Logistic regression": (LogisticRegression(random_state=SEED), {
        "C": [0.3, 0.5, 0.6, 0.8, 1.0], "penalty": ["l1", "l2"],
        "solver": ["liblinear"], "max_iter": [2000],
    }),
    "K-nearest neighbors": (KNeighborsClassifier(), {
        "n_neighbors": [7, 9, 11, 13, 15], "weights": ["uniform", "distance"],
        "metric": ["minkowski"], "p": [2],
    }),
    "Support vector machine": (SVC(probability=True, random_state=SEED), {
        "C": [1.5, 2, 2.5, 3], "gamma": ["scale", 0.01, 0.05, 0.1], "kernel": ["rbf"],
    }),
    "Decision tree": (DecisionTreeClassifier(random_state=SEED), {
        "criterion": ["gini", "entropy"], "max_depth": [3, 4, 5, 6],
        "min_samples_split": [2, 5, 10], "min_samples_leaf": [2, 4, 6],
    }),
    "Random forest": (RandomForestClassifier(random_state=SEED), {
        "n_estimators": [100, 200], "max_depth": [5, 7, 10],
        "min_samples_split": [2, 5], "min_samples_leaf": [1, 2],
        "max_features": ["sqrt"], "criterion": ["gini"], "bootstrap": [True],
    }),
}


def pipeline(estimator):
    return Pipeline([
        ("preprocessor", ColumnTransformer([
            ("num", StandardScaler(), NUMERIC),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL),
        ])),
        ("classifier", clone(estimator)),
    ])


def metrics(model, test, labels):
    predicted = model.predict(test)
    scores = model.predict_proba(test)[:, 1]
    return {
        "accuracy": accuracy_score(labels, predicted),
        "precision": precision_score(labels, predicted, zero_division=0),
        "recall": recall_score(labels, predicted, zero_division=0),
        "f1": f1_score(labels, predicted, zero_division=0),
        "auc": roc_auc_score(labels, scores),
    }


def data_checks(frame):
    bounds = {
        "age": (18, 100), "trestbps": (80, 220), "chol": (100, 700),
        "thalach": (50, 230), "oldpeak": (0, 10),
    }
    screening = []
    for key, (low, high) in bounds.items():
        values = frame[key]
        first, third = values.quantile([0.25, 0.75])
        distance = 1.5 * (third - first)
        screening.append({
            "feature": key, "low": low, "high": high,
            "outside": int((~values.between(low, high)).sum()),
            "outliers": int((~values.between(first - distance, third + distance)).sum()),
            "median": float(values.median()), "iqr": round(float(third - first), 3),
        })
    # Bin ages and omit pairs with either label count below five.
    ages = pd.cut(frame.age, [20, 40, 50, 60, 70, 80], right=False)
    patterns = {}
    for key, values in [("age", ages), *[(key, frame[key]) for key in CATEGORICAL]]:
        counts = pd.crosstab(values, frame.target)
        patterns[key] = [
            {"group": f"{group.left}–{group.right - 1}" if key == "age" else str(group),
             "negative": int(negative), "positive": int(positive)}
            for group, (negative, positive) in counts.iterrows()
            if min(negative, positive) >= 5
        ]
    return {"screening": screening, "patterns": patterns}


def export(dataset, destination, jobs):
    warnings.filterwarnings("ignore", message=".*penalty.*deprecated", module=r"sklearn\.linear_model\._logistic")
    warnings.filterwarnings("ignore", message="Inconsistent values: penalty=l1.*",
                            module=r"sklearn\.linear_model\._logistic")
    raw = pd.read_csv(dataset)
    raw.columns = raw.columns.str.strip().str.lower()
    frame = raw.drop_duplicates().reset_index(drop=True)
    if frame[FEATURES + ["target"]].isna().any().any() or set(frame.target) != {0, 1}:
        raise ValueError("Expected nonmissing study features and binary target values 0 and 1.")
    train, test, train_y, test_y = train_test_split(
        frame[FEATURES], frame.target, test_size=0.2, stratify=frame.target, random_state=SEED,
    )
    folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    results = []
    fitted = {}
    for name, (estimator, grid) in MODELS.items():
        baseline = pipeline(estimator).fit(train, train_y)
        search = GridSearchCV(
            pipeline(estimator), {f"classifier__{key}": value for key, value in grid.items()},
            scoring="accuracy", cv=folds, n_jobs=jobs,
        ).fit(train, train_y)
        model = search.best_estimator_
        fitted[name] = model
        probabilities = model.predict_proba(test)[:, 1]
        fpr, tpr, _ = roc_curve(test_y, probabilities)
        scores = [float(search.cv_results_[f"split{fold}_test_score"][search.best_index_])
                  for fold in range(folds.get_n_splits())]
        results.append({
            "name": name, "baseline": metrics(baseline, test, test_y),
            "test": metrics(model, test, test_y),
            "cv": {"mean": search.best_score_, "std": float(np.std(scores)), "folds": scores},
            "parameters": {key.removeprefix("classifier__"): value
                           for key, value in search.best_params_.items()},
            "confusion": confusion_matrix(test_y, model.predict(test), labels=[0, 1]).tolist(),
            "roc": np.column_stack((fpr, tpr)).round(6).tolist(),
        })
        print(f"{name}: CV={search.best_score_:.4f}, test accuracy={results[-1]['test']['accuracy']:.4f}",
              flush=True)
    results.sort(key=lambda row: (row["test"]["accuracy"], row["test"]["auc"]), reverse=True)
    demo = fitted["Logistic regression"]
    processor = demo.named_steps["preprocessor"]
    estimator = demo.named_steps["classifier"]
    scaler = processor.named_transformers_["num"]
    encoder = processor.named_transformers_["cat"]
    if list(estimator.classes_) != [0, 1]:
        raise ValueError("Unexpected coefficient class order.")

    background = processor.transform(train.sample(n=min(50, len(train)), random_state=SEED))
    explained = test.sample(n=min(50, len(test)), random_state=SEED)
    coefficient = estimator.coef_[0]
    reference = background.mean(axis=0)
    # Independent-background Linear SHAP in log-odds space.
    contributions = (processor.transform(explained) - reference) * coefficient
    encoded_names = processor.get_feature_names_out().tolist()
    magnitudes = np.abs(contributions).mean(axis=0)
    ranked = np.argsort(-magnitudes, kind="stable")
    top_numeric = next(int(index) for index in ranked if index < len(NUMERIC))
    x = explained[NUMERIC[top_numeric]]
    bins = pd.cut(x, bins=5)
    dependence = []
    for interval in bins.cat.categories:
        selected = np.asarray(bins == interval)
        if selected.sum() >= 5:
            dependence.append({
                "low": float(interval.left), "high": float(interval.right),
                "count": int(selected.sum()), "mean": float(contributions[selected, top_numeric].mean()),
            })

    correlation = frame[FEATURES + ["target"]].corr().round(3)
    study = {
        "dataset": {
            "original": len(raw), "clean": len(frame), "duplicates": len(raw) - len(frame),
            "missing": int(raw.isna().sum().sum()), "train": len(train), "test": len(test),
            "negative": int((frame.target == 0).sum()), "positive": int((frame.target == 1).sum()),
            "sha256": hashlib.sha256(dataset.read_bytes()).hexdigest(),
        },
        "reproduction": {"seed": SEED, "sklearn": sklearn.__version__},
        "models": results,
        "shap": {
            "samples": len(explained), "background": len(background),
            "importance": [
                {"feature": encoded_names[index], "mean": round(float(magnitudes[index]), 6),
                 "signedMean": round(float(contributions[:, index].mean()), 6)}
                for index in ranked
            ],
            "dependence": {"feature": NUMERIC[top_numeric], "bins": dependence},
        },
        "correlation": {"features": list(correlation.columns), "matrix": correlation.to_numpy().tolist()},
        "exploration": data_checks(frame),
    }
    model = {
        "name": "Logistic regression", "intercept": float(estimator.intercept_[0]),
        "referenceLogit": float(estimator.intercept_[0] + np.dot(coefficient, reference)),
        "numeric": [
            {"key": key, "center": float(scaler.mean_[index]), "scale": float(scaler.scale_[index]),
             "min": float(frame[key].min()), "max": float(frame[key].max()),
             "coefficient": float(coefficient[index]), "reference": float(reference[index])}
            for index, key in enumerate(NUMERIC)
        ],
        "categorical": [],
    }
    position = len(NUMERIC)
    for key, values in zip(CATEGORICAL, encoder.categories_):
        model["categorical"].append({
            "key": key,
            "levels": [
                {"value": int(value), "coefficient": float(coefficient[position + index]),
                 "reference": float(reference[position + index])}
                for index, value in enumerate(values)
            ],
        })
        position += len(values)
    destination.mkdir(parents=True, exist_ok=True)
    for name, artifact in [("study", study), ("model", model)]:
        (destination / f"{name}.json").write_text(
            json.dumps(artifact, allow_nan=False, separators=(",", ":")) + "\n", encoding="utf-8",
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "dist" / "data")
    parser.add_argument("--jobs", type=int, default=1)
    args = parser.parse_args()
    export(args.dataset, args.output, args.jobs)
