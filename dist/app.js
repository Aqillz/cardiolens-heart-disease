import { examples, featureLabel, fields, predict } from "./model.js";
import { getAnswer } from "./guide.js";

const find = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const percent = value => (value * 100).toFixed(2) + "%";
const signed = value => (value > 0 ? "+" : "") + value.toFixed(3);

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

const views = all(".view");
const navLinks = all("nav a");
const tabs = all('[role="tab"]');

function showView(focusHeading = false) {
  const requested = location.hash.slice(1);
  if (requested === "main") return;
  const active = views.find(view => view.id === requested) || views[0];
  views.forEach(view => { view.hidden = view !== active; });
  navLinks.forEach(link => {
    if (link.hash === "#" + active.id) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (focusHeading) {
    active.querySelector("h1").focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function selectTab(key, focus = false) {
  tabs.forEach(tab => {
    const isActive = tab.id === "tab-" + key;
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !isActive;
    if (isActive && focus) tab.focus();
  });
}

window.addEventListener("hashchange", () => showView(true));
document.addEventListener("click", event => {
  const link = event.target.closest("[data-panel-link]");
  if (link) selectTab(link.dataset.panelLink, location.hash === "#results");
});
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectTab(tab.id.slice(4)));
  tab.addEventListener("keydown", event => {
    const options = { ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length, Home: 0, End: tabs.length - 1 };
    if (!Object.hasOwn(options, event.key)) return;
    event.preventDefault();
    selectTab(tabs[options[event.key]].id.slice(4), true);
  });
});
showView();

function bars(container, values, maximum) {
  container.replaceChildren(...values.map(({ name, amount, display }) => {
    const row = element("div", undefined, "bar-row");
    const meter = element("meter");
    meter.min = 0;
    meter.max = maximum;
    meter.value = amount;
    meter.setAttribute("aria-label", name + " " + display);
    row.append(element("span", name), meter, element("strong", display));
    return row;
  }));
}

function row(cells, firstIsHeading = true) {
  const tr = element("tr");
  cells.forEach((value, i) => {
    const cell = element(firstIsHeading && i === 0 ? "th" : "td", value);
    if (i === 0 && firstIsHeading) cell.scope = "row";
    tr.append(cell);
  });
  return tr;
}

function makeTable(headers, tableRows) {
  const table = element("table");
  const head = table.createTHead().insertRow();
  headers.forEach(value => {
    const cell = element("th", value);
    cell.scope = "col";
    head.append(cell);
  });
  table.createTBody().append(...tableRows.map(item => row(item)));
  return table;
}

let study;
const comparisonMode = find("#comparison-mode");
const modelSelect = find("#model-select");

function renderMetrics() {
  const version = comparisonMode.value;
  const ordered = [...study.models].sort((a, b) => b[version].accuracy - a[version].accuracy || b[version].auc - a[version].auc);
  find("#metric-rows").replaceChildren(...ordered.map(item => {
    const { accuracy, precision, recall, f1, auc } = item[version];
    return row([item.name, ...[accuracy, precision, recall, f1].map(percent), auc.toFixed(4)]);
  }));
}

function renderConfusion() {
  const chosen = study.models[Number(modelSelect.value)];
  const [[tn, fp], [fn, tp]] = chosen.confusion;
  const panel = find("#confusion");
  panel.replaceChildren(
    makeTable(["Actual label", "Predicted 0", "Predicted 1"], [
      ["Label 0 (negative)", tn, fp], ["Label 1 (positive)", fn, tp],
    ]),
    element("p", fn + " positive records and " + fp + " negative records were misclassified.", "notice"),
  );
}

function renderROC(models) {
  const canvas = find("#roc");
  const ctx = canvas.getContext("2d");
  const colors = ["#5145cd", "#006a65", "#ad482c", "#78567b", "#2d6088"];
  const styles = [[], [9, 4], [3, 3], [13, 4], [7, 3, 2, 3]];
  const legend = find("#roc-legend");
  models.forEach((item, index) => {
    const entry = element("li", undefined, "legend-" + index);
    const marker = element("i");
    marker.setAttribute("aria-hidden", "true");
    entry.append(marker, document.createTextNode(item.name + " " + item.test.auc.toFixed(3)));
    legend.append(entry);
  });
  if (!ctx) return;
  const left = 58;
  const top = 16;
  const right = canvas.width - 20;
  const bottom = canvas.height - 52;
  const x = value => left + value * (right - left);
  const y = value => bottom - value * (bottom - top);
  ctx.font = "14px Segoe UI, sans-serif";
  ctx.fillStyle = "#3b4664";
  ctx.strokeStyle = "#dde3ee";
  for (let i = 0; i <= 5; i++) {
    const fraction = i / 5;
    ctx.beginPath();
    ctx.moveTo(x(0), y(fraction));
    ctx.lineTo(x(1), y(fraction));
    ctx.moveTo(x(fraction), y(0));
    ctx.lineTo(x(fraction), y(1));
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillText(fraction.toFixed(1), x(fraction), bottom + 22);
    ctx.textAlign = "right";
    ctx.fillText(fraction.toFixed(1), left - 8, y(fraction) + 4);
  }
  ctx.textAlign = "center";
  ctx.fillText("False positive rate", (left + right) / 2, canvas.height - 7);
  ctx.save();
  ctx.translate(15, (top + bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("True positive rate", 0, 0);
  ctx.restore();

  function curve(points, color, dash, width) {
    ctx.strokeStyle = color;
    ctx.setLineDash(dash);
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach(([fpr, tpr], index) => {
      if (index === 0) ctx.moveTo(x(fpr), y(tpr));
      else ctx.lineTo(x(fpr), y(tpr));
    });
    ctx.stroke();
  }

  curve([[0, 0], [1, 1]], "#98a2b6", [5, 5], 1.5);
  models.forEach((item, i) => curve(item.roc, colors[i], styles[i], 2.1));
}

function renderStudy(data) {
  study = data;
  const { dataset, models, shap, correlation, exploration } = study;
  const champion = models[0];
  const facts = { records: dataset.clean, models: models.length, accuracy: percent(champion.test.accuracy), auc: Math.max(...models.map(item => item.test.auc)).toFixed(3) };
  Object.entries(facts).forEach(([key, value]) => { find('[data-stat="' + key + '"]').textContent = value; });
  bars(find("#overview-models"), models.map(model => ({
    name: model.name, amount: model.test.accuracy, display: percent(model.test.accuracy),
  })), 1);
  const rankings = shap.importance.map(({ feature, mean }) => ({
    name: featureLabel(feature), amount: mean, display: mean.toFixed(3),
  }));
  const peak = rankings[0].amount;
  bars(find("#overview-factors"), rankings.slice(0, 5), peak);
  bars(find("#shap-global"), rankings.slice(0, 10), peak);
  find("#shap-rows").replaceChildren(...shap.importance.map(item =>
    row([featureLabel(item.feature), item.mean.toFixed(3), signed(item.signedMean)])));
  find("#dependence").replaceChildren(makeTable(
    [fields[shap.dependence.feature].label, "Records", "Mean impact"],
    shap.dependence.bins.map(bin => [bin.low.toFixed(2) + " to " + bin.high.toFixed(2), bin.count, signed(bin.mean)]),
  ));

  models.forEach((item, index) => {
    const option = element("option", item.name);
    option.value = index;
    modelSelect.append(option);
  });
  modelSelect.addEventListener("change", renderConfusion);
  comparisonMode.addEventListener("change", renderMetrics);
  renderMetrics();
  renderConfusion();
  renderROC(models);
  const validation = [...models].sort((a, b) => b.cv.mean - a.cv.mean);
  find("#cv-rows").replaceChildren(...validation.map(item =>
    row([item.name, ...[item.cv.mean, item.cv.std, ...item.cv.folds].map(percent)])));
  const parameters = element("dl", undefined, "parameters");
  validation.forEach(item => parameters.append(
    element("dt", item.name),
    element("dd", Object.entries(item.parameters).map(([key, value]) => key + " = " + value).join(", ")),
  ));
  find("#best-parameters").replaceChildren(parameters);

  bars(find("#dataset-bars"), [
    { name: "Negative label (0)", amount: dataset.negative, display: dataset.negative },
    { name: "Positive label (1)", amount: dataset.positive, display: dataset.positive },
  ], dataset.clean);
  [["Source rows", dataset.original], ["Duplicate rows removed", dataset.duplicates],
    ["Missing values", dataset.missing], ["Training records", dataset.train],
    ["Held-out records", dataset.test], ["Input features", correlation.features.length - 1]]
    .forEach(([label, value]) => {
      const check = element("div");
      check.append(element("dt", label), element("dd", value));
      find("#data-checks").append(check);
    });
  const corrTable = makeTable(["Feature", ...correlation.features],
    correlation.matrix.map((values, i) => [correlation.features[i], ...values.map(value => value.toFixed(2))]));
  corrTable.querySelectorAll("td").forEach(cell => {
    const value = Number(cell.textContent);
    cell.className = value >= .25 ? "positive" : value <= -.25 ? "negative" : "neutral";
  });
  find("#correlation").replaceChildren(corrTable);
  renderExploration(exploration);
}

function renderExploration({ screening, patterns }) {
  const select = find("#feature-select");
  const groups = find("#feature-patterns");
  for (const key of Object.keys(patterns)) {
    const option = element("option", fields[key].label);
    option.value = key;
    select.append(option);
  }
  function showGroups() {
    const key = select.value;
    const rows = patterns[key].map(({ group, negative, positive }) => [
      key === "age" ? group + " years" : (fields[key].options?.[group] || "Code " + group), negative, positive,
    ]);
    const content = rows.length
      ? makeTable([fields[key].label, "Label 0", "Label 1"], rows)
      : element("p", "No groups met the display threshold.", "muted");
    groups.replaceChildren(content);
  }
  select.addEventListener("change", showGroups);
  showGroups();
  find("#numeric-screening").replaceChildren(makeTable(
    ["Input", "Study range", "Outside", "IQR outliers", "Median", "IQR"],
    screening.map(item => [fields[item.feature].label, item.low + "–" + item.high, item.outside,
      item.outliers, item.median, item.iqr]),
  ));
}

const output = find("#prediction-result");
const form = find("#prediction-form");
const initialResult = "Load an example or complete the form to see a classification and its main contributing factors.";

function renderPrediction(result, referenceLogit) {
  const classification = result.label === 1 ? "Positive dataset label (1)" : "Negative dataset label (0)";
  const reference = percent(1 / (1 + Math.exp(-referenceLogit)));
  const list = element("ul", undefined, "contribution-list");
  result.contributions.slice(0, 5).forEach(({ key, impact }) => {
    const item = element("li");
    item.append(element("span", fields[key].label), element("strong", signed(impact), impact >= 0 ? "raises" : "lowers"));
    list.append(item);
  });
  output.replaceChildren(
    element("strong", percent(result.score), "score"),
    element("p", classification, "score-label"),
    element("p", "Positive-label model score · 50% cutoff", "muted"),
    element("h3", "Largest feature contributions", "prediction-factors"),
    list,
    element("p", "Positive values raise the log-odds and negative values lower them relative to the study background (model score " + reference + ").", "muted"),
  );
}

function initPredictor(model) {
  const container = find("#prediction-fields");
  for (const feature of [...model.numeric, ...model.categorical]) {
    const { key } = feature;
    const info = fields[key];
    const wrapper = element("div", undefined, "field");
    const label = element("label", info.label, "field-label");
    const input = element(feature.levels ? "select" : "input");
    input.name = key;
    input.id = "input-" + key;
    label.htmlFor = input.id;
    input.required = true;
    let description;
    if (feature.levels) {
      const placeholder = element("option", "Select a code");
      placeholder.value = "";
      input.append(placeholder);
      feature.levels.forEach(({ value }) => {
        const option = element("option", info.options?.[value] || "Code " + value);
        option.value = value;
        input.append(option);
      });
      description = info.hint;
    } else {
      input.type = "number";
      input.min = feature.min;
      input.max = feature.max;
      input.step = info.decimal ? "any" : "1";
      description = feature.min + "–" + feature.max + " " + info.unit;
    }
    wrapper.append(label, input);
    if (description) {
      const hint = element("small", description);
      hint.id = input.id + "-hint";
      input.setAttribute("aria-describedby", hint.id);
      wrapper.append(hint);
    }
    container.append(wrapper);
  }
  const clearResult = () => output.replaceChildren(element("p", initialResult, "muted"));
  [find("#sample-a"), find("#sample-b")].forEach((button, index) => {
    button.disabled = false;
    button.addEventListener("click", () => {
      Object.entries(examples[index]).forEach(([key, value]) => { form.elements.namedItem(key).value = value; });
      form.requestSubmit();
    });
  });
  find("#predict-button").disabled = false;
  form.addEventListener("input", clearResult);
  form.addEventListener("reset", clearResult);
  form.addEventListener("submit", event => {
    event.preventDefault();
    const values = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value === "" ? NaN : Number(value)]));
    try {
      renderPrediction(predict(model, values), model.referenceLogit);
    } catch (error) {
      output.replaceChildren(element("p", error.message, "error"));
    }
  });
}

const messages = find("#messages");
const question = find("#question");

function message(text, kind, link) {
  const bubble = element("div", text, "bubble " + kind);
  if (link) {
    const anchor = element("a", link[0]);
    anchor.href = link[1];
    anchor.rel = "noreferrer";
    if (link[2]) anchor.dataset.panelLink = link[2];
    bubble.append(anchor);
  }
  messages.append(bubble);
  while (messages.childElementCount > 25) messages.firstElementChild.remove();
  messages.scrollTop = messages.scrollHeight;
}

function resetChat() {
  messages.replaceChildren();
  question.value = "";
  message("Ask me how the model works, what its scores mean, or about general heart-healthy habits.", "assistant");
}

function ask(text) {
  if (!text.trim()) return;
  message(text, "user");
  const answer = getAnswer(text, study);
  message(answer.text, "assistant", answer.link);
  question.value = "";
}

find("#chat-form").addEventListener("submit", event => {
  event.preventDefault();
  ask(question.value);
});
find("#clear-chat").addEventListener("click", resetChat);
all("[data-prompt]").forEach(button => button.addEventListener("click", () => ask(button.dataset.prompt)));
resetChat();

async function loadData(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Unable to load " + path);
  return response.json();
}

loadData("./data/study.json").then(renderStudy).catch(() => {
  const failure = "Study data could not load. Refresh this page to try again.";
  ["#overview-models", "#overview-factors"].forEach(selector =>
    find(selector).replaceChildren(element("p", failure, "error")));
  const cell = element("td", failure, "error");
  cell.colSpan = 6;
  const tr = element("tr");
  tr.append(cell);
  find("#metric-rows").replaceChildren(tr);
});
loadData("./data/model.json").then(initPredictor).catch(() => {
  output.replaceChildren(element("p", "Model data could not load. Refresh this page to try again.", "error"));
});
